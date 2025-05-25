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

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Middleware para tratamento assíncrono de erros
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Função que cria o prompt de formatação
function createLuaFormattingPrompt(code, context) {
    return `Formate este código Lua para Roblox Studio com foco em clareza, boas práticas e organização. Siga rigorosamente as instruções abaixo:

1. Sempre use parênteses nas condições de estruturas de controle como if, while, etc. Exemplo: if (condicao) then.
2. Aplique espaçamento consistente e indentação correta.
3. Reorganize o código separando por seções nesta ordem:

**Seções obrigatórias:**

- Serviços: todas as chamadas a game:GetService agrupadas no topo, sem linhas em branco entre elas.
- Módulos: requires ou dependências locais.
- Variáveis de instância/configuração.
- Conexões de eventos.
- Execução principal.

4. Se encontrar uso de 'ReplicatedStorage.Remotes', crie uma variável 'local Remotes = ReplicatedStorage:WaitForChild("Remotes", 5)' se for código de **cliente** (LocalScript).  
Se for código de **server** (Script ou ModuleScript server), use 'local Remotes = ReplicatedStorage.Remotes'.

5. Caso o código seja para o **cliente**, todo acesso a instâncias dinâmicas como 'ReplicatedStorage', 'Remotes', etc., deve ser feito usando 'WaitForChild("Nome", 5)'.  
Sempre use um **timeout de 5 segundos** no 'WaitForChild'.

6. Se o código for **server**, use acesso direto sem 'WaitForChild'.

7. Nunca adicione comentários, explicações ou qualquer tipo de marcação.

8. Nunca adicione espaçamentos extras entre linhas dentro de blocos relacionados, só entre as **seções** definidas.

9. Responda somente com o código puro, sem qualquer tipo de marcação ou delimitador.

**Importante:** Considere que o código a seguir é de tipo: **${context}**  
As opções de contexto são: 'LocalScript', 'Script', 'ModuleScript Client', 'ModuleScript Server'.

Aqui está o código para formatar:

${code}`;
}

app.post("/format-lua", asyncHandler(async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Missing 'code' in request body." });
    }

    const prompt = createLuaFormattingPrompt(code);

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ]
    };

    const { data } = await axios.post(`${GEMINI_API_URL}?key=${API_KEY}`, requestBody, {
        headers: { "Content-Type": "application/json" }
    });

    const formattedCode = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!formattedCode) {
        return res.status(502).json({
            error: "Invalid response structure from Gemini API.",
            response: data
        });
    }

    return res.json({ formattedCode });
}));

// Middleware global para tratamento de erros não capturados
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        details: err.message
    });
});

app.listen(SERVER_PORT, () => {
    console.log(`Server listening on port: ${SERVER_PORT}`);
});
