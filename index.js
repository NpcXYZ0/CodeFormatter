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

    let parenthesesInstruction = "1. Use parênteses em condições de estruturas de controle (`if`, `while`, etc.) somente quando necessário para clareza ou para alterar a precedência de operadores. Não adicione parênteses desnecessários. Exemplo: `if condicao then` ou `if (a or b) and c then`.";
    if (useAlwaysParentheses) {
        parenthesesInstruction = "1. Sempre use parênteses nas condições de estruturas de controle como `if`, `while`, etc. Exemplo: `if (condicao) then`.";
    }

    let andOrIdiomInstruction = "";
    if (preferAndOrIdiom) {
        andOrIdiomInstruction = "\n- Se aplicável e para maior concisão, considere usar o idioma `condicao and valorSeVerdadeiro or valorSeFalso` para atribuições ou retornos, mas **somente se** `valorSeVerdadeiro` NUNCA puder ser `false` ou `nil`. Caso contrário, use `if/else` explícito para evitar bugs.";
    }

    return `Formate este código Lua para Roblox Studio com foco em clareza, boas práticas e organização. Siga rigorosamente as instruções abaixo:

${parenthesesInstruction}
2. Aplique espaçamento consistente e indentação correta (use tabs ou 4 espaços, seja consistente).
3. Reorganize o código separando por seções nesta ordem. Dentro de cada seção, certifique-se de que as variáveis sejam declaradas antes de seu primeiro uso. Se uma variável \`A\` depende de uma variável \`B\`, \`B\` deve ser declarada antes de \`A\`:
    - Serviços: todas as chamadas a \`game:GetService\` agrupadas no topo, sem linhas em branco entre elas.
    - Módulos: \`require()\` para ModuleScripts ou dependências locais.
    - Variáveis de instância/configuração global do script.
    - Funções auxiliares.
    - Conexões de eventos (\`.Event:Connect(...)\`).
    - Execução principal do script (código que roda quando o script inicia, se houver).
${andOrIdiomInstruction}
4. Se encontrar uso de 'ReplicatedStorage.Remotes', crie uma variável 'local Remotes = ReplicatedStorage:WaitForChild("Remotes", 5)' se for código de **cliente** (LocalScript ou ModuleScript Client).  
Se for código de **server** (Script ou ModuleScript Server), use 'local Remotes = ReplicatedStorage.Remotes'.
5. Caso o código seja para o **cliente** (LocalScript, ModuleScript Client), todo acesso a instâncias dinâmicas como itens em 'ReplicatedStorage', 'StarterPlayerScripts', 'StarterGui', etc., deve ser feito usando ':WaitForChild("Nome", 5)'.  
Sempre use um **timeout de 5 segundos** no ':WaitForChild'.
6. Se o código for **server** (Script, ModuleScript Server), use acesso direto sem ':WaitForChild' para serviços como 'ServerScriptService', 'ServerStorage', ou para objetos que você tem certeza que já existem no momento da execução. Para objetos em 'ReplicatedStorage' acessados pelo servidor, o uso direto é comum, assumindo que foram replicados.
7. Nunca adicione comentários explicativos ao código formatado, apenas o código.
8. Nunca adicione espaçamentos extras desnecessários entre linhas dentro de blocos relacionados (funções, loops, condicionais). Adicione uma linha em branco apenas entre as **seções principais** definidas no item 3 e entre definições de funções de nível superior.
9. Responda somente com o código Lua puro, sem qualquer tipo de marcação (como \`\`\`lua ... \`\`\`) ou delimitador.

**SUPER IMPORTANTE**: A sua resposta DEVE ser APENAS o código Lua formatado. Não inclua nenhuma palavra, explicação, ou markdown como \`\`\`lua ou \`\`\`. Qualquer texto fora do código Lua puro causará erro.

**Importante:** Considere que o código a seguir é de tipo: **${context}**  
As opções de contexto são: 'LocalScript', 'Script', 'ModuleScript Client', 'ModuleScript Server'.

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