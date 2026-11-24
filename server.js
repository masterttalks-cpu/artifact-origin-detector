require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROBOFLOW_ENDPOINT = "https://serverless.roboflow.com/tavish-kurray/workflows/ancient-artifact-origin";
const ALLOWED_ORIGINS = ["chinese", "egyptian", "indian"];

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", async (request, response) => {
   const base64Image = request.body?.image;
   if (typeof base64Image !== "string" || base64Image.length === 0) {
       return response.status(400).json({ error: "No image was provided." });
   }

   if (!process.env.ROBOFLOW_API_KEY) {
       return response.status(500).json({ error: "The AI service has not been configured." });
   }

   try {
       const roboflowResponse = await fetch(ROBOFLOW_ENDPOINT, {
           method: "POST",
           headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${process.env.ROBOFLOW_API_KEY}`
           },
           body: JSON.stringify({
               inputs: {
                   image: { type: "base64", value: base64Image },
                   confidence: 0.4
               }
           })
       });

       const rawText = await roboflowResponse.text();
       let roboflowResult;
       try {
           roboflowResult = JSON.parse(rawText);
       } catch {
           return response.status(502).json({ error: "The AI service returned an invalid response." });
       }

       if (!roboflowResponse.ok) {
           return response.status(502).json({ error: "The AI service could not analyze the image." });
       }

       const prediction = findClassificationPrediction(roboflowResult);
       if (!prediction) {
           return response.status(502).json({ error: "No classification was returned by the Model." });
       }

       const normalizedOrigin = prediction.className.trim().toLowerCase();
       const expectedOrigin = ALLOWED_ORIGINS.find((origin) => origin === normalizedOrigin);

       return response.json({
           origin: expectedOrigin ? capitalize(expectedOrigin) : prediction.className,
           confidence: prediction.confidence,
           isExpectedOrigin: Boolean(expectedOrigin)
       });
   } catch (error) {
       return response.status(500).json({ error: "Unable to connect to the AI service." });
   }
});

function findClassificationPrediction(root) {
   let bestPrediction = null;
   function consider(className, confidence) {
       if (typeof className !== "string" || className.trim().length === 0) return;
       const numericConfidence = Number(confidence);
       const candidate = {
           className: className.trim(),
           confidence: Number.isFinite(numericConfidence) ? numericConfidence : null
       };
       if (!bestPrediction) { bestPrediction = candidate; return; }
       if (candidate.confidence !== null && (bestPrediction.confidence === null || candidate.confidence > bestPrediction.confidence)) {
           bestPrediction = candidate;
       }
   }

   function walk(node) {
       if (!node) return;
       if (Array.isArray(node)) { node.forEach(walk); return; }
       if (typeof node !== "object") return;
       if (typeof node.top === "string") {
           let confidence = node.confidence;
           if (node.predictions && !Array.isArray(node.predictions) && typeof node.predictions === "object") {
               confidence = node.predictions[node.top]?.confidence ?? confidence;
           }
           consider(node.top, confidence);
       }
       const className = node.className ?? node.class_name ?? node.class;
       if (typeof className === "string") consider(className, node.confidence ?? node.score);
       Object.values(node).forEach(walk);
   }

   walk(root);
   return bestPrediction;
}

function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

app.listen(PORT, () => { console.log(`Artifact Origin Detector running at http://localhost:${PORT}`); });
