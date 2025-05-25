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
    return `Formate este código Lua para Roblox Studio aplicando indentação correta e boas práticas, mantendo a funcionalidade idêntica. Sempre use parênteses nas condições de estruturas de controle como if, while, etc., por exemplo: if (condicao) then. Utilize espaçamento consistente e boa indentação. Utilize de conceitos avançados para formatar e ir sempre pensando como iria ficar. Responda apenas com o código puro, sem explicações, sem comentários, sem marcações de qualquer tipo (como crases, aspas, ou blocos de código). Envie somente o texto do código, sem qualquer formatação extra ou indicação de linguagem. Nunca utilize crases ou qualquer outro delimitador para marcar o código. Aqui está o código para formatar:\n\n${code}`;
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
