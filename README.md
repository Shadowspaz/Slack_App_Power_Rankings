# Slack_App_Power_Rankings
Adds an Elo rating system to your Slack server.

This was built as a fun little project, during a time when our whole office was getting really into ping pong. I wrote this to allow for a more competitive scene with stat tracking, and it was cool to watch people rise and fall through the rankings. This was also a fun dive into the Elo rating system.

We used it for ping pong, but it could just as easily be used for any other 1v1 game.

## Setup

Copy this script as a new GScript for Slack to connect to.

Create a Google Spreadsheet for the script to access. This is where the rankings will be stored.

Edit the following fields in the script to match your server:
- ___incomingURL:___ Incoming URL from Slack app setup
- ___hookToken:___ Token from Slack app setup
- ___slackCommand:___ Name used to execute script. For example if the name is "pingpong", it would be used via "/pingpong top"
- ___slackChannel:___ Name of the channel to push updates to. This includes Elo changes, adding, and removing players.
- ___adminUser:___ User with admin access. I just set this as myself for ease of cleanup/debugging, but this could be expanded to include a list of names with little effort.
- ___spreadsheetID:___ Google Spreadsheet ID to save rankings. This can be found in the URL of the spreadsheet.
- ___scoreboardTitle:___ Title of the scoreboard

---

I'm sure I could turn this into a proper Slack app without the need for this manual setup, but I was unsure how to approach the leaderboard storage in such a case.
