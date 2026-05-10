// server.js — Family Card Studio backend
// Run: node server.js   (after `npm install` and creating .env)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("."));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const IMAGE_MODEL =
  process.env.IMAGE_MODEL || "google/gemini-3.1-flash-image-preview";

if (!OPENROUTER_API_KEY) {
  console.warn(
    "⚠️  Missing OPENROUTER_API_KEY in .env — image generation will fail.",
  );
}

// ---------- Prompt Engineering ("Her Style") ----------
// Multiple variants per occasion → diverse outputs that still match the theme.
const THEMES = {
  birthday: [
    "a white frosted layer cake on a glass cake stand with lit colorful birthday candles, rainbow sprinkles scattered on a marble surface, soft pastel balloons blurred in the background",
    "a single beautifully decorated cupcake with a tiny lit candle, confetti softly out of focus, bright cheerful daylight",
    "an elegant ceramic mug surrounded by pastel balloons and gentle confetti on a wooden table, soft morning light",
    "a tiered birthday cake with delicate buttercream rosettes, gold candles glowing, dreamy bokeh of fairy lights behind",
  ],
  anniversary: [
    "a bouquet of soft pink roses and white baby's breath resting on a rustic wooden table beside a folded kraft-paper card with a red gingham ribbon",
    "two delicate champagne flutes catching warm sunset light, rose petals scattered on linen",
    "an open vintage book with a pressed rose on top, warm candlelight, romantic muted palette",
    "a heart-shaped arrangement of blush and ivory roses on a creamy linen cloth, soft window light",
  ],
  "mother's day": [
    "a lush bouquet of pink roses, carnations and baby's breath beside a pastel pink heart-printed mug on a soft pink backdrop, hand-drawn hearts faintly visible",
    "a mother's hands gently holding a small bouquet of wildflowers, warm soft focus, airy pastel tones",
    "a delicate teacup with floating rose petals on a lace doily, springtime bokeh",
    "a bright window sill with a vase of peonies and a handwritten note, gentle morning sunbeam",
  ],
  wedding: [
    "two simple gold wedding bands resting on ivory silk beside white peonies, soft natural light",
    "a romantic bouquet of white roses and eucalyptus on a marble surface, airy and bright",
    "a tiered white wedding cake with subtle floral detailing, dreamy chiffon backdrop",
  ],
  graduation: [
    "a graduation cap resting on a stack of books beside a small bouquet of sunflowers, warm afternoon light",
    "a rolled diploma tied with a gold ribbon on a wooden desk, soft window glow",
    "celebratory confetti softly falling around a single elegant gold star ornament",
  ],
  thank_you: [
    "a small bouquet of white daisies in a clear glass jar beside a folded handwritten note, clean linen background",
    "a delicate teacup with a sprig of lavender resting on the saucer, soft pastel palette",
  ],
  default: [
    "a serene still-life of fresh seasonal flowers and a softly lit ceramic object on a clean linen surface, gentle natural light",
  ],
};

function pickVariant(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeEvent(event) {
  const e = (event || "").toLowerCase().trim();
  if (e.includes("birthday")) return "birthday";
  if (e.includes("anniversary")) return "anniversary";
  if (e.includes("mother")) return "mother's day";
  if (e.includes("wedding")) return "wedding";
  if (e.includes("graduat")) return "graduation";
  if (e.includes("thank")) return "thank_you";
  return null;
}

function buildPrompt({ event, theme }) {
  const key = normalizeEvent(event);
  const variants = key ? THEMES[key] : THEMES.default;
  const subject = pickVariant(variants);
  const userTheme = theme ? `, incorporating ${theme}` : "";
  return [
    "A high-resolution, centered photograph of",
    subject + userTheme + ".",
    "Minimalist composition with ample empty negative space at the top and bottom for text overlays.",
    "Soft bokeh background, warm classic palette, gentle film-like grain,",
    "professional product-photography lighting, shot on 50mm lens, shallow depth of field, photorealistic.",
  ].join(" ");
}

// ---------- Endpoint ----------
app.post("/api/generate-card", async (req, res) => {
  try {
    const { event = "", theme = "" } = req.body || {};
    const prompt = buildPrompt({ event, theme });
    console.log("🎨 Prompt:", prompt);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Family Card Studio",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", response.status, errText);
      return res.status(response.status).json({
        error: "Image generation failed",
        details: errText,
      });
    }

    const data = await response.json();
    // Gemini image models return images on message.images[].image_url.url as a data URL
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return res.status(500).json({ error: "No image returned", raw: data });
    }

    res.json({ imageUrl, prompt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//const PORT = process.env.PORT || 3000;
//app.listen(PORT, () => console.log(`✨ Family Card Studio running → http://localhost:${PORT}`));
export default app;
