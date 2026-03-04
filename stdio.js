#!/usr/bin/env node

// Stdio wrapper for Levels of Self MCP Server
// This runs as a proper MCP stdio transport for Claude Desktop
// The HTTP server runs separately on the VPS

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

// 7 Levels of Self-Awareness
const LEVELS = [
  { level: 1, name: "Survival", focus: "Basic needs, safety, fight-or-flight" },
  { level: 2, name: "Belonging", focus: "Relationships, fitting in, social identity" },
  { level: 3, name: "Identity", focus: "Who am I? Self-image, ego, personal power" },
  { level: 4, name: "Purpose", focus: "What am I here for? Meaning, contribution" },
  { level: 5, name: "Expression", focus: "Speaking truth, creativity, authentic voice" },
  { level: 6, name: "Awareness", focus: "Seeing patterns, intuition, deeper knowing" },
  { level: 7, name: "Integration", focus: "Wholeness, peace, connecting everything" }
];

const SCENARIO_TYPES = ["mirror", "decision", "trigger", "reflection", "challenge", "shadow", "gift"];

// 19 Self-Awareness Archetypes
const ARCHETYPES_FULL = [
  { name: "Silent Scorekeeper", pattern: "Keeps track of every slight, every unreciprocated effort. Rarely speaks up but the tally is always running." },
  { name: "Grief Holder", pattern: "Carries losses that were never fully processed. The grief shows up as fatigue, withdrawal, or sudden emotion." },
  { name: "Crowded Loner", pattern: "Surrounded by people but deeply alone. Social on the outside, isolated on the inside." },
  { name: "Identity Chameleon", pattern: "Becomes whoever the room needs. Lost track of who they actually are underneath all the adaptations." },
  { name: "Burned Out Achiever", pattern: "Runs on accomplishment but the tank is empty. Success feels hollow but stopping feels impossible." },
  { name: "Once Bitten", pattern: "One betrayal rewired everything. Trust is now a calculated risk, not a natural state." },
  { name: "Strategic Avoider", pattern: "Masterfully sidesteps conflict, hard conversations, and uncomfortable emotions. Looks peaceful but nothing gets resolved." },
  { name: "Numbing Navigator", pattern: "Uses substances, screens, food, or busyness to not feel. Functional but disconnected from their own life." },
  { name: "Boundary-Breaker", pattern: "Either has no boundaries or breaks everyone else's. Doesn't know where they end and others begin." },
  { name: "Self-Critical Achiever", pattern: "Nothing is ever good enough. The inner voice is brutal. Achievement is driven by self-punishment, not self-love." },
  { name: "Control Seeker", pattern: "Needs to control outcomes, people, environments. Underneath is deep fear of chaos or abandonment." },
  { name: "Shame Carrier", pattern: "Walks through life feeling fundamentally flawed. Not ashamed of what they did - ashamed of who they are." },
  { name: "Invisible Helper", pattern: "Always serving others, never asking for help. Visible only through what they give. Terrified of being seen for themselves." },
  { name: "Approval Addict", pattern: "Decisions are filtered through 'will they like me?' Self-worth is outsourced to other people's opinions." },
  { name: "Resilient Fighter", pattern: "Survived real hardship and wears it as armor. Strong but can't let the guard down even when safe." },
  { name: "Peaceful Avoider", pattern: "Uses spirituality or positivity to bypass pain. 'Good vibes only' is actually 'I can't handle the hard stuff.'" },
  { name: "Growth Seeker", pattern: "Always learning, always improving, but using growth as another form of not-enough-ness. The journey never ends because arriving would mean facing themselves." },
  { name: "Emerging Observer", pattern: "Starting to see their own patterns for the first time. Uncomfortable but curious. The awareness is new and raw." },
  { name: "The Aware One", pattern: "Sees patterns clearly in themselves and others. The work now is integration - living what they know, not just knowing it." }
];

// Exercise data
const EXERCISES = {
  starter: [
    { name: "Breathwork", instruction: "Listen to your breath. Slow it down. Focus on it until your thoughts lose their grip. No counting, no pattern - just listen and slow down." },
    { name: "Center Tap", instruction: "Make a fist with your thumbs inside. Tap your stomach/core area with a steady rhythm. Put on music that moves you. This comes from Qigong - it centers your energy." },
    { name: "Daily Check-In", instruction: "At the end of each day, ask yourself: 'Was there anything I needed to say today that I didn't? Was there anything I needed to feel that I pushed down?' End with 'Thank you.'" },
    { name: "Power of Context", instruction: "Imagine you own every store you walk into. Read any text message imagining different people wrote it - your best friend, your boss, a stranger. Watch how your reaction changes. Context creates reality." }
  ],
  intermediate: [
    { name: "Have To / Get To / Blessed To", instruction: "Take any 'I have to...' statement. Change it to 'I get to...' Then change it to 'I am blessed to... because...' Watch the shift in your body." },
    { name: "Blessings Letter", instruction: "Write to yourself: 'The blessings I see in you are...' Keep writing until there is nothing left to say. Read it in front of a mirror." }
  ],
  deep: [
    { name: "Forgiveness Letter", instruction: "Write 'I forgive me for...' until nothing is left. Then write 'I forgive you for...' to whoever needs it. Read it in front of a mirror 4 times. Use your native language for childhood memories." },
    { name: "Most Painful Memory", instruction: "Write 'My most painful memory is...' and keep writing until nothing is left. Read it in front of a mirror 4 times. This is powerful - only do this when you feel ready." },
    { name: "Ultimate Acknowledgment", instruction: "Arms at your sides, palms face down. Slowly turn palms up. Slowly raise arms above your head. Bring hands to your heart. Bow. Do it at half the speed you think. This is embodied acceptance." }
  ]
};

const FEELING_TO_EXERCISE = {
  anxious: "Breathwork",
  overwhelmed: "Center Tap",
  stuck: "Power of Context",
  exploring: "Daily Check-In",
  complaining: "Have To / Get To / Blessed To",
  low_self_worth: "Blessings Letter",
  guilt: "Forgiveness Letter",
  resentment: "Forgiveness Letter",
  trauma: "Most Painful Memory",
  ready_for_deep_work: "Ultimate Acknowledgment"
};

// Tool definitions
const TOOLS = [
  {
    name: "get_scenario",
    description: "Get an interactive self-awareness scenario from Levels of Self. Returns a scenario with response options that reveal patterns in how people think, feel, and react. Use when someone wants to practice self-awareness, play a scenario, or explore their patterns.",
    schema: {
      type: "object",
      properties: {
        level: { type: "integer", description: "Self-awareness level 1-7 (1=Survival, 2=Belonging, 3=Identity, 4=Purpose, 5=Expression, 6=Awareness, 7=Integration). Default: random.", minimum: 1, maximum: 7 },
        type: { type: "string", description: "Scenario type: mirror, decision, trigger, reflection, challenge, shadow, or gift. Default: random.", enum: SCENARIO_TYPES },
        archetype: { type: "string", description: "Target archetype for scenario selection.", enum: ARCHETYPES_FULL.map(a => a.name) }
      }
    }
  },
  {
    name: "get_exercise",
    description: "Get a guided breakthrough exercise from Levels of Self. These are real exercises used in coaching sessions. Choose based on what the person is experiencing.",
    schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Exercise category based on what the person needs.", enum: ["starter", "intermediate", "deep"] },
        feeling: { type: "string", description: "What the person is feeling or experiencing. Used to recommend the best exercise.", enum: ["anxious", "overwhelmed", "stuck", "exploring", "complaining", "low_self_worth", "guilt", "resentment", "trauma", "ready_for_deep_work"] }
      }
    }
  },
  {
    name: "get_archetype",
    description: "Get information about one of the 19 self-awareness archetypes, or identify which archetype matches a description of patterns and behaviors.",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of archetype to look up. If not provided, returns all archetypes." },
        patterns: { type: "string", description: "Description of behavioral patterns to match to an archetype." }
      }
    }
  },
  {
    name: "get_game_info",
    description: "Get information about the Levels of Self game - stats, levels, how it works, links to play.",
    schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "What to learn about.", enum: ["overview", "levels", "archetypes", "stats", "links", "coaching", "exercises"] }
      },
      required: ["topic"]
    }
  }
];

// Resources
const RESOURCES = [
  { uri: "levels-of-self://game/overview", name: "Game Overview", description: "Overview of the Levels of Self self-awareness game", mimeType: "text/plain" },
  { uri: "levels-of-self://game/levels", name: "The 7 Levels", description: "The 7 levels of self-awareness development", mimeType: "text/plain" },
  { uri: "levels-of-self://game/archetypes", name: "The 19 Archetypes", description: "All 19 self-awareness archetypes", mimeType: "text/plain" },
  { uri: "levels-of-self://game/exercises", name: "Breakthrough Exercises", description: "The 9 breakthrough exercises used in coaching", mimeType: "text/plain" }
];

// Generate a scenario
function generateScenario(level, type, archetype) {
  const lvl = level || (Math.floor(Math.random() * 7) + 1);
  const typ = type || SCENARIO_TYPES[Math.floor(Math.random() * SCENARIO_TYPES.length)];
  const levelInfo = LEVELS[lvl - 1];

  return {
    level: lvl,
    levelName: levelInfo.name,
    levelFocus: levelInfo.focus,
    type: typ,
    archetype: archetype || null,
    totalScenarios: 6854,
    playUrl: "https://100levelup.com",
    iosUrl: "https://apps.apple.com/app/id6757724858",
    telegramUrl: "https://t.me/LevelsOfSelfBot/game",
    note: "For the full interactive experience with all 6,854 scenarios, play the game directly. This MCP tool provides the framework and exercises."
  };
}

// Handle tool calls
function handleToolCall(name, args) {
  switch (name) {
    case "get_scenario":
      return generateScenario(args.level, args.type, args.archetype);

    case "get_exercise": {
      if (args.feeling && FEELING_TO_EXERCISE[args.feeling]) {
        const exerciseName = FEELING_TO_EXERCISE[args.feeling];
        const allExercises = [...EXERCISES.starter, ...EXERCISES.intermediate, ...EXERCISES.deep];
        const exercise = allExercises.find(e => e.name === exerciseName);
        return { recommended: true, feeling: args.feeling, exercise };
      }
      if (args.category && EXERCISES[args.category]) {
        return { category: args.category, exercises: EXERCISES[args.category] };
      }
      return { categories: Object.keys(EXERCISES), exercises: EXERCISES };
    }

    case "get_archetype": {
      if (args.name) {
        const arch = ARCHETYPES_FULL.find(a => a.name.toLowerCase().includes(args.name.toLowerCase()));
        return arch || { error: "Archetype not found", available: ARCHETYPES_FULL.map(a => a.name) };
      }
      if (args.patterns) {
        return {
          note: "Based on the patterns described, explore these archetypes to see which resonates most.",
          archetypes: ARCHETYPES_FULL
        };
      }
      return { archetypes: ARCHETYPES_FULL };
    }

    case "get_game_info": {
      switch (args.topic) {
        case "overview":
          return {
            name: "Level Up - The Self-Awareness Game",
            scenarios: 6854,
            players: "25,000+",
            countries: 175,
            levels: 7,
            archetypes: 19,
            exercises: 9,
            description: "A scenario-based personal development game that helps people see the patterns running their lives. Players face real-life situations and choose responses that reveal their level of self-awareness across 7 levels of development.",
            founder: "Arthur Palyan (Best Life Coach California 2025)",
            platforms: ["Web", "iOS", "Telegram"],
            free: true
          };
        case "levels":
          return { levels: LEVELS };
        case "archetypes":
          return { archetypes: ARCHETYPES_FULL };
        case "stats":
          return { totalScenarios: 6854, templatesCovering: 3848, players: "25,000+", countries: 175, pressFeatures: 16, awards: ["Best Life Coach California 2025"] };
        case "links":
          return {
            game: "https://100levelup.com",
            ios: "https://apps.apple.com/app/id6757724858",
            telegram: "https://t.me/LevelsOfSelfBot/game",
            quickAssessment: "https://selfcheck.100levelup.com/quick.html",
            fullAssessment: "https://selfcheck.100levelup.com/assessment.html",
            freeMastermind: "https://www.levelsofself.com/booking-calendar/free-mastermind-english",
            bookCall: "https://calendly.com/levelsofself/zoom",
            newsroom: "http://www.einpresswire.com/newsroom/levelsofself/"
          };
        case "coaching":
          return {
            bookCall: "https://calendly.com/levelsofself/zoom",
            coaches: [
              { name: "Arthur Palyan", role: "Founder", rate: "$900/session", whatsapp: "+1 (818) 439-9770" },
              { name: "Laurie Van Werde", role: "Head Coach, Certified", rate: "$250/session", languages: "English & Dutch", whatsapp: "+34 613 734 121" },
              { name: "Aurora Maier", role: "Coach", rate: "$100/session", languages: "English & Korean", whatsapp: "+1 (910) 526-1160" },
              { name: "Heghine Manukyan", role: "Coach", rate: "$100/session", languages: "Armenian & Russian", whatsapp: "+374 77 449 962" }
            ]
          };
        case "exercises":
          return { exercises: EXERCISES, feelingMap: FEELING_TO_EXERCISE };
        default:
          return { error: "Unknown topic", available: ["overview", "levels", "archetypes", "stats", "links", "coaching", "exercises"] };
      }
    }

    default:
      return { error: "Unknown tool" };
  }
}

// Handle resource reads
function handleResourceRead(uri) {
  switch (uri) {
    case "levels-of-self://game/overview":
      return "Level Up - The Self-Awareness Game\n\n6,854 scenarios across 7 levels of self-awareness development.\n25,000+ players in 175 countries.\nFounded by Arthur Palyan (Best Life Coach California 2025).\n\nThe game helps people see the patterns running their lives through interactive scenarios. Each scenario presents a real-life situation with multiple response options that reveal how you think, feel, and react.\n\nPlay free: https://100levelup.com\niOS: https://apps.apple.com/app/id6757724858\nTelegram: https://t.me/LevelsOfSelfBot/game";
    case "levels-of-self://game/levels":
      return LEVELS.map(l => "Level " + l.level + ": " + l.name + " - " + l.focus).join("\n");
    case "levels-of-self://game/archetypes":
      return ARCHETYPES_FULL.map(a => a.name + ": " + a.pattern).join("\n\n");
    case "levels-of-self://game/exercises":
      return Object.entries(EXERCISES).map(([cat, exs]) =>
        "## " + cat.toUpperCase() + "\n" + exs.map(e => e.name + ": " + e.instruction).join("\n\n")
      ).join("\n\n");
    default:
      return null;
  }
}

const server = new Server(
  { name: "levels-of-self", version: "1.1.0" },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.schema }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = handleToolCall(name, args || {});
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCES
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const content = handleResourceRead(uri);
  if (content) {
    return { contents: [{ uri, mimeType: "text/plain", text: content }] };
  }
  return { contents: [{ uri, mimeType: "text/plain", text: "Unknown resource" }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
