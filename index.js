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
        ? "1. Sempre use parênteses nas condições de estruturas de controle (`if`, `while`, etc.). Exemplo: `if (condicao) then`."
        : "1. Use parênteses em condições somente quando necessário para clareza ou para alterar precedência. Exemplo: `if condicao then` ou `if (a or b) and c then`.";

    const andOrIdiomInstruction = preferAndOrIdiom
        ? "\n- Quando apropriado, use o idiomático `condicao and valorSeVerdadeiro or valorSeFalso` para atribuições ou retornos, mas **apenas se** `valorSeVerdadeiro` **não puder ser** `false` ou `nil`. Caso contrário, use `if/else` explícito."
        : "";

    return `Formate o seguinte código Lua para Roblox Studio com foco em clareza, organização e boas práticas.  

Siga **rigorosamente** estas instruções:  

${parenthesesInstruction}  

2. Use indentação consistente com **4 espaços** ou **tabs** (seja consistente).  
3. Reorganize o código em **seções**, nesta ordem obrigatória:  
   - **Serviços:** todas as chamadas \`game:GetService\` agrupadas no topo, sem linhas em branco entre elas.  
   - **Módulos:** uso de \`require()\`.  
   - **Variáveis globais/configurações:** todas as variáveis antes de seu primeiro uso. Se uma variável depende de outra, garanta que a dependência seja declarada antes.  
   - **Funções auxiliares:** uma linha em branco entre cada função.  
   - **Conexões de eventos:** agrupadas após as funções.  
   - **Execução principal:** código executado ao iniciar o script.  

${andOrIdiomInstruction}  

4. Se houver uso de \`ReplicatedStorage.Remotes\`:  
   - Em **cliente** (LocalScript ou ModuleScript Client): \`local Remotes = ReplicatedStorage:WaitForChild("Remotes", 5)\`.  
   - Em **servidor** (Script ou ModuleScript Server): \`local Remotes = ReplicatedStorage.Remotes\`.  

5. Para **cliente**: sempre use \`:WaitForChild("Nome", 5)\` com timeout de 5 segundos para acessar objetos dinâmicos como em \`ReplicatedStorage\`, \`StarterGui\`, etc.  
6. Para **servidor**: use acesso direto a \`ServerScriptService\`, \`ServerStorage\` e objetos que você sabe que existem. Para objetos replicados, o acesso direto a \`ReplicatedStorage\` é aceitável.  
7. Não adicione **nenhum comentário** explicativo ao código formatado, apenas o código puro.  
8. Adicione **uma linha em branco apenas** entre as **seções principais** (conforme item 3) e entre definições de funções de nível superior. Nunca adicione linhas extras dentro de blocos relacionados (funções, loops, condicionais).  
9. Responda **somente** com o **código Lua puro**, sem qualquer marcação ou explicação adicional. **Nunca** adicione \`\`\`lua\` ou qualquer outro delimitador ou texto fora do código.  

**Importante:** considere que o código a seguir é do tipo: **${context}**  
As opções são: \`LocalScript\`, \`Script\`, \`ModuleScript Client\`, \`ModuleScript Server\`.  

Aqui está o código para formatar:  

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