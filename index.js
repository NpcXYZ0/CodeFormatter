const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

app.post("/format-lua", async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Missing 'code' in request body." });
    }

    const prompt = `Formate este código Lua para Roblox Studio, aplicando indentação correta e boas práticas, mantendo a funcionalidade idêntica. Sempre coloque parênteses nas condições de if, while, etc., por exemplo: 'if (condicao) then'. Use espaçamento consistente e boa indentação. Envie apenas o código puro, sem explicações, sem marcações como crases (\`\`\`), e sem indicação de linguagem, APENAS TEXTO PURO:\n\n${code}`;

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ]
    };

    try {
        const response = await axios.post(`${GEMINI_API_URL}?key=${API_KEY}`, requestBody, {
            headers: { "Content-Type": "application/json" }
        });

        const result = response.data;
        const parts = result?.candidates?.[0]?.content?.parts?.[0];

        if (parts && parts.text) {
            return res.json({ formattedCode: parts.text });
        } else {
            return res.status(500).json({ error: "Unexpected response from Gemini API.", raw: result });
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error.response?.data || error.message);
        return res.status(500).json({ error: "Failed to format code.", details: error.response?.data || error.message });
    }
});

app.listen(process.env.SERVER_PORT, () => {
    console.log("Server listening on port:", process.env.SERVER_PORT);
});
