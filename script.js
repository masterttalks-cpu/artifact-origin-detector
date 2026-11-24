const fileInput = document.getElementById("artifact-upload");
const analyzeButton = document.getElementById("analyze-btn");
const resultText = document.getElementById("prediction-text");
const imagePreview = document.getElementById("image-preview");

let selectedBase64Image = null;

fileInput.addEventListener("change", async () => {
   clearResultStyle();
   const file = fileInput.files[0];

   if (!file) {
       selectedBase64Image = null;
       imagePreview.hidden = true;
       imagePreview.removeAttribute("src");
       resultText.textContent = "Waiting for an image...";
       return;
   }

   const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
   if (!acceptedTypes.includes(file.type)) {
       selectedBase64Image = null;
       imagePreview.hidden = true;
       showResult("Please choose a JPEG, PNG, or WebP image.", "error");
       return;
   }

   const maximumSize = 10 * 1024 * 1024;
   if (file.size > maximumSize) {
       selectedBase64Image = null;
       imagePreview.hidden = true;
       showResult("The selected image is larger than 10 MB.", "error");
       return;
   }

   try {
       const dataUrl = await readFileAsDataUrl(file);
       imagePreview.src = dataUrl;
       imagePreview.hidden = false;
       selectedBase64Image = dataUrl.split(",")[1];
       showResult('Image ready. Press "Analyze Artifact".', "");
   } catch (error) {
       console.error("Image reading error:", error);
       selectedBase64Image = null;
       imagePreview.hidden = true;
       showResult("The image could not be read.", "error");
   }
});

analyzeButton.addEventListener("click", async () => {
   if (!selectedBase64Image) {
       showResult("Please choose or photograph an artifact first.", "warning");
       return;
   }

   setLoading(true);
   showResult("Analyzing visual styles... 🔍", "");

   try {
       const response = await fetch("/api/analyze", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ image: selectedBase64Image })
       });

       const result = await response.json();
       if (!response.ok) throw new Error(result.error || "The analysis request failed.");
       if (!result.origin) throw new Error("The Model did not return a readable prediction.");

       const confidenceText = typeof result.confidence === "number"
           ? ` (${Math.round(result.confidence * 100)}% confidence)`
           : "";

       if (result.isExpectedOrigin) {
           showResult(`${result.origin.toUpperCase()}${confidenceText}`, "success");
       } else {
           showResult(`Uncertain: the Model returned "${result.origin}"${confidenceText}. This result needs review.`, "warning");
       }
   } catch (error) {
       console.error("Analysis error:", error);
       showResult(error.message || "Unable to connect to the AI service.", "error");
   } finally {
       setLoading(false);
   }
});

function readFileAsDataUrl(file) {
   return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = () => resolve(reader.result);
       reader.onerror = () => reject(reader.error);
       reader.readAsDataURL(file);
   });
}

function setLoading(isLoading) {
   analyzeButton.disabled = isLoading;
   analyzeButton.textContent = isLoading ? "Analyzing..." : "Analyze Artifact";
}

function showResult(message, styleName) {
   clearResultStyle();
   resultText.textContent = message;
   if (styleName) resultText.classList.add(styleName);
}

function clearResultStyle() {
   resultText.classList.remove("success", "warning", "error");
}
