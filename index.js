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
    return `Formate este código Lua para Roblox Studio com foco em clareza, boas práticas e separação lógica. Siga rigorosamente as instruções abaixo:

1. Sempre use parênteses nas condições de estruturas de controle como if, while, etc. Exemplo: if (condicao) then.
2. Aplique espaçamento consistente e indentação correta.
3. Reorganize o código separando por seções na seguinte ordem e forma:

**Seções obrigatórias:**

- Serviços: todas as chamadas a game:GetService devem estar agrupadas no topo, sem quebras entre elas.
- Módulos: requires ou dependências locais.
- Variáveis de instância/configuração: ex: instâncias de classes, como 'local bob = ...'.
- Conexões de eventos: agrupadas e sem espaçamento entre elas.
- Funções declaradas: se houver.
- Execução principal: ex: chamadas de inicialização, como 'bob:start()'.

4. Entre cada **seção**, adicione **uma única linha em branco** para delimitação visual.  
5. Dentro de cada seção, **não** adicione linhas em branco entre comandos relacionados.  
6. Nunca adicione comentários, explicações ou qualquer outra marcação.
7. Responda apenas com o código puro, sem qualquer tipo de formatação, marcação ou delimitador (sem crases, aspas, blocos de código, etc).

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
