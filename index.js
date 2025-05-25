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
function createLuaFormattingPrompt(code) {
    return `Formate este código Lua para Roblox Studio aplicando indentação correta, boas práticas e separação lógica por seções comuns, mantendo a funcionalidade idêntica. Sempre siga as orientações abaixo:

- Utilize parênteses em todas as condições de estruturas de controle como if, while, etc. Exemplo: if (condicao) then.
- Aplique espaçamento consistente e boa indentação em todo o código.
- Reorganize o código separando por seções na seguinte ordem lógica:
    1. Serviços (ex: game:GetService)
    2. Requires ou módulos locais
    3. Variáveis ou configurações
    4. Conexões de eventos (como Connects de eventos do Roblox)
    5. Funções declaradas
    6. Execução principal (ex: chamadas que inicializam ou executam código)

- Ajuste a ordem do código para seguir essa estrutura de seções, mas sempre mantendo a lógica e funcionalidade originais.
- Nunca adicione comentários, explicações ou qualquer outra marcação.
- Responda apenas com o código puro, sem qualquer tipo de formatação, marcação, ou delimitador (sem crases, aspas, blocos de código, etc). Nunca coloque nenhum marcador, apenas o texto puro.
- Lembre-se: envie somente o código puro e formatado, sem qualquer explicação.

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
