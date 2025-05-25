const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const { API_KEY, SERVER_PORT } = process.env;

if (!API_KEY) {
    console.error("FATAL ERROR: Missing API_KEY in environment variables.");
    process.exit(1);
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

function createLuaFormattingPrompt(code, context, options = {}) {
  const {
    useAlwaysParentheses = true,
    preferAndOrIdiom = false
  } = options;

  const parenthesesInstruction = useAlwaysParentheses
    ? "1. Sempre use parênteses nas condições das estruturas de controle (`if`, `while`, etc.). Exemplo: `if (condicao) then`."
    : "1. Use parênteses em condições somente quando necessário para clareza ou precedência. Exemplo: `if condicao then` ou `if (a or b) and c then`.";

  const andOrIdiomInstruction = preferAndOrIdiom
    ? "\n- Use a expressão idiomática `condicao and valorSeVerdadeiro or valorSeFalso` para atribuições/retornos somente quando `valorSeVerdadeiro` não puder ser `false` ou `nil`. Caso contrário, use `if/else` explícito."
    : "";

  return `Formate o código Lua para Roblox Studio com foco em clareza, organização e boas práticas.

Siga estritamente as regras abaixo:

${parenthesesInstruction}

2. Use indentação consistente de 4 espaços (nunca tabs).

3. Organize o código em seções, na ordem e formato exato a seguir, separando-as por **exatamente uma linha em branco**:

   a) **Serviços:** todas as chamadas \`game:GetService()\` no topo, agrupadas sem linhas em branco entre elas.

   b) **Módulos:** todas as chamadas \`require()\`, agrupadas sem linhas em branco entre elas.

   c) **Variáveis globais/configurações:** todas as variáveis declaradas antes do primeiro uso, na ordem de dependência, agrupadas sem linhas em branco entre elas.

   d) **Funções auxiliares:** declare cada função com exatamente uma linha em branco entre elas, sem linhas extras dentro do corpo da função.

   e) **Conexões de eventos:** agrupadas logo após as funções, separadas das funções por uma linha em branco, sem linhas em branco entre as conexões.

   f) **Execução principal:** código executado diretamente, separado das conexões por uma linha em branco.

4. Nunca insira linhas em branco dentro de blocos (funções, loops, condicionais).

5. Para acessar \`ReplicatedStorage.Remotes\`:

   - No **cliente** (LocalScript/ModuleScript Client): use \`local Remotes = ReplicatedStorage:WaitForChild("Remotes", 5)\`.

   - No **servidor** (Script/ModuleScript Server): use \`local Remotes = ReplicatedStorage.Remotes\`.

6. No **cliente**, sempre use \`:WaitForChild("Nome", 5)\` para objetos dinâmicos (ex: \`StarterGui\`, \`ReplicatedStorage\`).

7. No **servidor**, acesse objetos estáticos diretamente (ex: \`ServerScriptService\`, \`ServerStorage\`).

8. Não adicione comentários explicativos, apenas o código puro.

9. Responda **somente** com o código Lua puro, sem delimitadores, sem texto extra.

${andOrIdiomInstruction}

Este código é do tipo: **${context}**

Código a formatar:

${code}`;
}

app.post("/format-lua", asyncHandler(async (req, res) => {
    const { code, context, options } = req.body;

    if (!code || !context) {
        return res.status(400).json({ error: "Missing 'code' or 'context' in request body." });
    }

    const formattingOptions = options || {};
    const prompt = createLuaFormattingPrompt(code, context, formattingOptions);

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.3, // Ajuste para mais determinismo
            topP: 0.9,
            topK: 40
        }
    };

    try {
        const { data } = await axios.post(`${GEMINI_API_URL}?key=${API_KEY}`, requestBody, {
            headers: { "Content-Type": "application/json" }
        });

        const formattedCode = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!formattedCode) {
            console.error("Invalid response structure from Gemini API:", data);
            return res.status(502).json({
                error: "Invalid response structure from Gemini API.",
                response: data
            });
        }

        return res.json({ formattedCode });

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message);
        let errorDetails = error.message;
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
            errorDetails = error.response.data.error.message;
        } else if (error.response && error.response.data) {
            errorDetails = JSON.stringify(error.response.data);
        }
        return res.status(500).json({
            error: "Error communicating with formatting service.",
            details: errorDetails
        });
    }
}));

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        details: err.message
    });
});

app.listen(SERVER_PORT || 3000, () => {
    console.log(`Server listening on port: ${SERVER_PORT || 3000}`);
});