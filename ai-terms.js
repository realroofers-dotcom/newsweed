/* ai-terms.js — BUILT 2026-09-29 · ai-terms-1a
   The AI term of the day (top-left of every page) and the glossary at /ai.html.
   One term a day, in order; after the last term it starts again. Add terms at the END so
   the order of past days doesn't change. Plain English, no hype. */

(function () {
  var T = [
    ["artificial-intelligence", "Artificial intelligence (AI)", "Computer programs that do tasks we used to think needed a person: reading, writing, recognizing faces, translating, planning.", "AI is a broad label, not one machine. Most of what is sold as AI today is machine learning: software that learned patterns from huge amounts of examples instead of being given step-by-step rules."],
    ["machine-learning", "Machine learning", "Teaching a computer by example instead of by rules.", "Show a program thousands of past loan applications and how they turned out, and it learns which details predict a default. It finds patterns; it does not understand why they hold, and it repeats any bias that was in the examples."],
    ["large-language-model", "Large language model (LLM)", "An AI trained on enormous amounts of text to predict the next word, which lets it write, answer and summarize.", "ChatGPT, Claude and Gemini are built on LLMs. They are very good with language and can be confidently wrong about facts, so anything important should be checked."],
    ["hallucination", "Hallucination", "When an AI states something false as if it were true.", "An AI may invent a court case, a quote or a statistic that sounds right. It is not lying on purpose; it is producing likely-sounding text. Always check sources."],
    ["prompt", "Prompt", "The instruction or question you type to an AI.", "Clear prompts get better answers: say who it is for, what you want, and what to leave out. \"Prompt engineering\" is simply getting good at asking."],
    ["chatbot", "Chatbot", "A program you talk to in plain language, by text or voice.", "Old chatbots followed scripts. New ones run on large language models and can hold a real conversation, which also makes them easier to mistake for a person."],
    ["training-data", "Training data", "The examples an AI learned from.", "An AI is only as good, as fair and as current as its training data. If the data stops in a certain year, the AI may not know anything that happened after."],
    ["neural-network", "Neural network", "Software loosely modeled on the brain: layers of simple connected units that together learn complex patterns.", "Each unit does very simple math. Stacked by the millions and tuned on data, they can recognize speech, images and language."],
    ["deepfake", "Deepfake", "Fake video, audio or photos made with AI to look and sound real.", "A deepfake can put words in anyone's mouth. Before you share a shocking clip, check whether a trusted outlet has confirmed it."],
    ["generative-ai", "Generative AI", "AI that creates new things: text, images, music, video or code.", "It produces new material by remixing patterns from what it learned. Who owns that output, and whether training on others' work is fair, are live questions in the courts."],
    ["algorithm", "Algorithm", "A set of steps for solving a problem.", "A recipe is an algorithm. On social media, \"the algorithm\" means the rules that decide what you see next, usually tuned to keep you scrolling."],
    ["agent", "AI agent", "An AI that doesn't just answer but takes actions: browsing, filling forms, sending emails, running tasks.", "Agents can save time, and they can also make mistakes on your behalf. Good agents ask before doing anything that can't be undone."],
    ["computer-vision", "Computer vision", "AI that understands images and video.", "It reads license plates, spots tumors on scans, and guides self-driving cars. It can also be used for surveillance, which is why many cities debate its use."],
    ["facial-recognition", "Facial recognition", "AI that identifies a person from their face.", "Police, airports and phones use it. It has been shown to make more mistakes with some groups of people than others, and wrongful arrests have followed."],
    ["bias", "Algorithmic bias", "When an AI treats some groups unfairly because of the data or design behind it.", "If past hiring favored one group, an AI trained on those decisions will too. Fixing it takes deliberate testing, not good intentions."],
    ["token", "Token", "A small piece of text, often part of a word, that language AIs read and write.", "AI companies usually charge by the token. Roughly, 100 tokens is about 75 English words."],
    ["context-window", "Context window", "How much text an AI can keep in mind at one time.", "Anything outside the window is forgotten. Bigger windows let an AI read whole books or long contracts at once."],
    ["fine-tuning", "Fine-tuning", "Extra training that specializes a general AI for one job.", "A general model can be fine-tuned on medical notes or legal filings so it speaks that field's language better."],
    ["open-source-ai", "Open-source AI", "AI whose model files are published so anyone can run, study or change them.", "Supporters say it keeps AI in public hands; critics worry about misuse. Many \"open\" models share the model but not the training data."],
    ["automation", "Automation", "Machines or software doing work that people used to do.", "Automation has always changed jobs. The AI question is which tasks change, how fast, and whether workers share in the gains."],
    ["robotics", "Robotics", "Machines that sense and act in the physical world.", "From warehouse robots to farm harvesters, robotics joins AI to motors and sensors. On farms, it is increasingly used for picking, weeding and milking."],
    ["speech-recognition", "Speech recognition", "AI that turns spoken words into text.", "It powers voice assistants and live captions, and helps people who cannot type. It still struggles more with strong accents and noisy rooms."],
    ["voice-cloning", "Voice cloning", "AI that copies a person's voice from a short recording.", "Scammers use cloned voices to fake emergency calls from family. A family code word is a simple defense."],
    ["recommendation-engine", "Recommendation engine", "The system that suggests what to watch, buy or read next.", "It learns from what you and people like you clicked on. It can widen your world or narrow it to more of the same."],
    ["guardrails", "Guardrails", "Limits built into an AI to stop harmful or unwanted answers.", "Guardrails keep an AI from helping with crimes or giving dangerous advice. Too loose is risky; too tight makes the tool useless."],
    ["alignment", "Alignment", "Making sure an AI does what people actually intend, safely.", "An AI told to \"get more clicks\" might do it with outrage. Alignment work tries to make AI goals match human values, not just the literal instruction."],
    ["benchmark", "Benchmark", "A standard test used to compare AI systems.", "Companies love to announce benchmark wins. A high score on a test is not the same as doing a real job well."],
    ["gpu", "GPU", "A computer chip that does many small calculations at once, the workhorse of modern AI.", "Originally made for video games, GPUs now train and run AI. The demand has made chipmakers some of the most valuable companies in the world."],
    ["data-center", "Data center", "A building full of computers that store data and run online services and AI.", "AI data centers use enormous amounts of electricity and water, which is now a local issue for the towns that host them."],
    ["synthetic-data", "Synthetic data", "Made-up data generated by computers to train AI.", "It helps when real data is scarce or private. If it strays too far from reality, the AI learns the wrong lessons."],
    ["multimodal", "Multimodal AI", "AI that works with more than one kind of input: text, images, audio, video.", "A multimodal AI can look at a photo of a plant and tell you what's wrong with it, or listen to a meeting and write the minutes."],
    ["watermark", "AI watermark", "A hidden signal placed in AI-made content so it can be identified later.", "Watermarks could help spot fakes, but many can be stripped out. They are one tool, not a guarantee."],
    ["copilot", "Copilot", "An AI assistant built into software you already use, working alongside you.", "It drafts emails, suggests code or fills spreadsheets. The person stays the pilot and is responsible for what goes out."],
    ["inference", "Inference", "When a trained AI is actually used to answer or predict.", "Training is the expensive school years; inference is the daily work. Every question you ask an AI is an inference."],
    ["parameters", "Parameters", "The internal numbers an AI adjusts while learning.", "Big models have billions of them. More parameters can mean more capability, but not automatically better answers."],
    ["retrieval", "Retrieval-augmented generation (RAG)", "An AI that looks things up in trusted documents before answering.", "Instead of relying on memory, the AI searches a library, such as a company's manuals, and answers from what it finds. It cuts down on made-up facts."],
    ["predictive-policing", "Predictive policing", "Using data and AI to forecast where crime may happen or who may be involved.", "Supporters say it targets resources; critics say it can send police back to the same neighborhoods again and again. Several cities have dropped it."],
    ["precision-agriculture", "Precision agriculture", "Using sensors, GPS, drones and AI to farm field by field and even plant by plant.", "It lets farmers put water, seed and fertilizer only where needed, saving money and protecting soil."],
    ["turing-test", "Turing test", "An old test of whether a machine can pass as human in conversation.", "Proposed by Alan Turing in 1950. Today's chatbots can often pass it, which shows the test measures imitation, not understanding."],
    ["ai-literacy", "AI literacy", "Knowing what AI can and can't do, and how to use it wisely.", "Like reading a newspaper critically: know the source, check the facts, and remember that a confident answer is not the same as a correct one."]
  ];

  var TERMS = T.map(function (t) { return { slug: t[0], term: t[1], short: t[2], more: t[3] }; });
  var EPOCH = Date.UTC(2026, 8, 29); // 29 Sep 2026 = the first term
  function today() {
    var ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    var d = Math.floor((Date.UTC(ny.getFullYear(), ny.getMonth(), ny.getDate()) - EPOCH) / 86400000);
    return TERMS[((d % TERMS.length) + TERMS.length) % TERMS.length];
  }
  window.NW_AI = { terms: TERMS, today: today };
})();
