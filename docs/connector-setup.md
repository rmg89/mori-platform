# Reconnecting Claude to the Platform

Team Taheripour Platform. Connector setup, about 3 minutes.

This replaces the older guide that asked you to add an `Authorization` header. Claude's
custom connector screen has no field for request headers, so that version could never
work. The token now goes in the URL instead.

## Before you start

Ryan sends you one thing: your personal connect URL. It looks like this, with a long
random string on the end.

```
https://team-taheripour-platform.vercel.app/api/mcp?t=YOUR-TOKEN-HERE
```

Treat that whole URL like a password. Anyone who has it can read and edit the pipeline.
Don't paste it into email or Slack if you can avoid it, and don't put it in a screenshot.

Each person gets their own URL. If yours leaks, Ryan revokes just yours and the others
keep working.

You also need to be on Claude Pro, Max, Team, or Enterprise. Custom connectors aren't
available on the free plan.

## Step 1. Remove the old connector

If a Team Taheripour Platform connector is already listed, delete it before adding a new
one. Two copies conflict.

1. Click your name or profile icon in the bottom-left corner of Claude
2. Choose **Settings**
3. In the left sidebar, click **Connectors**
4. Find the existing Team Taheripour Platform entry
5. Click the three dots next to it, then **Remove**

If there's no existing entry, skip to Step 2.

## Step 2. Add the connector

1. Still on **Settings** then **Connectors**, click **Add custom connector**
2. Fill in the dialog:
   - **Name:** `Team Taheripour Platform`
   - **Remote MCP server URL:** the full URL Ryan sent you, including the `?t=` part
3. Ignore **Advanced settings**. You don't need an OAuth client ID or secret.
4. Click **Add**

The most common mistake is pasting only the first half of the URL. It has to end with
`?t=` and your token, with no space anywhere in it.

## Step 3. Turn it on in your conversation

Adding the connector doesn't switch it on. Enable it per chat.

1. Start a brand new conversation
2. Click the **+** button near the message box
3. Find **Team Taheripour Platform** in the list and toggle it on

## Step 4. Test it

In that same new conversation, type:

> What are Mori's upcoming engagements?

If it worked, Claude asks permission to use a tool, then returns real engagement data.

If it didn't, see below.

## Troubleshooting

**Connection error, "unauthorized", or 401.** The URL is wrong or incomplete. Re-copy it
from Ryan's message and check three things: it ends with `?t=` plus the token, there's no
space or line break in the middle, and nothing got cut off at the end.

**"No approval" error, or a tool call fails oddly.** Start a completely new conversation
and try again. Known quirk. The connection gets into a stale state and retrying in the
same chat never works. A fresh chat clears it.

**Claude says it can't find the tools.** Check Step 3. The connector has to be toggled on
inside each conversation, not just added in Settings.

**Tools behave like they're out of date, or a field is missing.** Same fix, new
conversation. Claude caches the tool list when a chat starts. If Ryan deployed an update
mid-conversation, your chat is still using the old version.

**It still won't connect.** Send Ryan a screenshot of the Settings then Connectors page
and the error message. Crop out the URL, or blur the part after `?t=`.

## Quick reference

| | |
|---|---|
| Server URL | `https://team-taheripour-platform.vercel.app/api/mcp?t=<your token>` |
| Advanced settings | Not used. Leave OAuth fields empty. |
| Settings path | Profile icon, Settings, Connectors |
| Enable in chat | **+** button, toggle connector on |
| Fix for almost anything | Start a new conversation |

## For Ryan: issuing and revoking tokens

Tokens live in the `MCP_TOKENS` env var on Vercel (Production and Preview), as
comma-separated `name:token` pairs:

```
chi:LONG-RANDOM-STRING,mori:ANOTHER-LONG-RANDOM-STRING
```

Generate one with `openssl rand -hex 32`. To revoke a single person, delete their pair and
redeploy. The older single shared `MCP_SECRET_TOKEN` still works and is still checked
first, so existing Claude Code and Claude Desktop setups that send a real `Authorization`
header keep working unchanged.
