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
    return `Formate este código Lua para Roblox Studio aplicando indentação correta, boas práticas e separação lógica por seções comuns, mantendo a funcionalidade idêntica. Siga rigorosamente as orientações:

1. Sempre use parênteses nas condições de estruturas de controle como if, while, etc. Exemplo: if (condicao) then.
2. Aplique espaçamento consistente e boa indentação.
3. Reorganize o código separando por seções na seguinte ordem lógica:
    - Serviços (ex: game:GetService)
    - Requires ou módulos locais
    - Variáveis de configuração ou instância
    - Conexões de eventos (como Connect)
    - Funções declaradas (se houver)
    - Execução principal (inicializações, chamadas principais)

4. Entre cada seção, adicione **uma linha em branco** para garantir visualização clara e organizada.
5. Nunca adicione comentários, explicações ou qualquer outra marcação.
6. Responda apenas com o código puro, sem qualquer tipo de formatação, marcação ou delimitador (sem crases, aspas, blocos de código, etc). Nunca coloque nenhum marcador, apenas o texto puro.
7. Mantenha a lógica e a funcionalidade originais.

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
