# Levels of Self - MCP Server

An MCP (Model Context Protocol) server that gives AI assistants access to the Levels of Self self-awareness game - 6,854 interactive scenarios across 7 levels of human development, 19 archetypes, and 9 breakthrough exercises used in real coaching sessions.

## What It Does

This server lets any MCP-compatible AI assistant (Claude, etc.) pull self-awareness content on demand:

- **Scenarios** - Interactive situations that reveal thinking and behavioral patterns
- **Exercises** - Guided breakthrough exercises matched to what someone is experiencing
- **Archetypes** - 19 behavioral archetypes for pattern recognition
- **Game Info** - Stats, levels, links, coaching options

All tools are read-only. No user data is collected or stored.

## Tools

| Tool | Description |
|------|-------------|
| `get_scenario` | Get an interactive self-awareness scenario by level, type, or archetype |
| `get_exercise` | Get a guided breakthrough exercise by category or current feeling |
| `get_archetype` | Look up archetypes or match behavioral patterns to an archetype |
| `get_game_info` | Get game overview, stats, levels, links, coaching info |

## Setup as Custom MCP Connector

### Hosted (Recommended)

The server is live and ready to use:

```
URL: https://api.100levelup.com/mcp/
Protocol: MCP 2024-11-05 (Streamable HTTP + SSE)
Authentication: None required
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "levels-of-self": {
      "url": "https://api.100levelup.com/mcp/"
    }
  }
}
```

### Self-Hosted

1. Clone this repo
2. Provide a `game-scenario-framework.json` data file (or contact us)
3. Run `node server.js`
4. Server starts on port 3471

## Example Prompts

Try these with any MCP-connected AI assistant:

1. **"Give me a self-awareness scenario about identity"** - Returns a Level 3 (Identity) scenario with response options that reveal patterns in how you see yourself.

2. **"I'm feeling overwhelmed - what exercise should I do?"** - Returns the Center Tap exercise from Qigong, specifically recommended for overwhelm.

3. **"What archetype matches someone who keeps score of every slight but never speaks up?"** - Identifies the Silent Scorekeeper archetype and its core pattern.

4. **"Tell me about the Levels of Self game - how many scenarios does it have?"** - Returns game overview with stats: 6,854 scenarios, 25,000+ players, 175 countries.

5. **"What are all the self-awareness archetypes?"** - Returns all 19 archetypes with their behavioral patterns.

## About

**Levels of Self** is a scenario-based personal development platform founded by Arthur Palyan (Best Life Coach California 2025). The game helps people see the patterns running their lives through interactive scenarios across 7 levels of self-awareness.

- Game: https://100levelup.com
- iOS: https://apps.apple.com/app/id6757724858
- Telegram: https://t.me/LevelsOfSelfBot/game
- Website: https://www.levelsofself.com
- Privacy: https://api.100levelup.com/family/privacy.html
- MCP Privacy: https://api.100levelup.com/family/mcp-privacy.html

## Support

- Email: artpalyan@levelsofself.com
- Book a call: https://calendly.com/levelsofself/zoom

## License

MIT - see [LICENSE](LICENSE)
