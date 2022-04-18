var params;
var defValue = [1000, 0, 0];
var k = [40, 20, 10]; // Starting k-factor, Under [gameLimit] and [scoreLimit], Over [scoreLimit] (ever)
var gameLimit = 30;
var scoreLimit = 1200;
var scalar = 400; // How quickly wins scale down. The higher, the slower.
var wonWords = ["beat", "defeated", "annihilated", "destroyed", "crippled", "wrecked", "won against", "shut down", "was victorious over", "crushed", "wasted"];

var incomingURL = "https://hooks.slack.com/services/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"; // Incoming URL from Slack app setup
var hookToken = "T2HoaDDd01AVCsnyBg0pOGjl" // Token from Slack app setup
var slackCommand = "pingpong" // Command used to execute script. For example, "/pingpong [command]"
var slackChannel = "pingpong" // Name of the channel to push updates to. This includes Elo changes, adding, and removing players.
var adminUser = "erik"; // User with admin access. I just set this as myself for ease of cleanup/debugging, but this could be expanded to include a list of names with little effort.

var spreadsheetID = "1OSdloaDSt6DrJssI4_ZezDR-7vmotrXA6FvDI0Cql6g"; // Google Spreadsheet ID to save rankings. This can be found in the URL of the spreadsheet.
var scoreboardTitle = "Ping Pong" // Title of the scoreboard

function doPost(req)
{
  
  params = req.parameter;
  
  if (params.token == hookToken)
  {
    var sheet = SpreadsheetApp.openById(spreadsheetID).getSheets()[0];
    
    var txt = String(params.text).toLowerCase();
    var txtarray = txt.split(" ");
    
    var reply;
    
    switch (txtarray[0]) {
      case "top":
        FetchLeaderboards(sheet);
        return ContentService.createTextOutput();
        break;
      case "add":
        reply = AddPlayer(sheet, txt.substring(4, txt.length));
        break;
      case "remove":
        reply = RemovePlayer(sheet, txt.substring(7, txt.length));
        break;
      case "undo":
        reply = Undo(sheet);
        break;
      case "clear":
        reply = ClearSheet(sheet);
        break;
      default:
        reply = HandleGames(sheet, txt);
        break;
    }
    
    return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON)
  }
}

function FetchLeaderboards(s)
{
  var r = {
    "channel": "#" + params.channel_name,
    "text": "_Fetching leaderboards..._"
  }
  
  DelaySend(r);
  
  ShowLeaderboards();

  return;
}

function ShowLeaderboards()
{ 
  
  var s = SpreadsheetApp.openById(spreadsheetID).getSheets()[0];
  
  var totalPlayers = s.getLastColumn() / 3;
  
  var p = GetPlacements(s, totalPlayers);
  
  var r = {
    "channel": "#" + params.channel_name,
    "text": "*_" + scoreboardTitle + " Power Rankings_*",
    "attachments": [
      {
        "color": "#000000",
        "fields": [
          {
            "title": "Player",
            "short": true
          },
          {
            "title": "W-L                Rating",
            "short": true
          }
        ]
      }
    ]
  };

  if (totalPlayers > 0)
  {
    var stats = GetStats(s, p[0]);
    r.attachments.push(
      {
        "color": "#FFDD00",
        "fields": [
          {
            "value": "#1:   " + GetName(s, p[0]),
            "short": true
          },
          {
            "value": stats[1] + " - " + stats[2] + "            " + stats[0],
            "short": true
          }
        ]
      });
  }

  if (totalPlayers > 1)
  {
    var stats = GetStats(s, p[1]);
    r.attachments.push(
      {
        "color": "#CCCCCC",
        "fields": [
          {
            "value": "#2:   " + GetName(s, p[1]),
            "short": true
          },
          {
            "value": stats[1] + " - " + stats[2] + "            " + stats[0],
            "short": true
          }
        ]
      });
  }
  if (totalPlayers > 2)
  {
    var stats = GetStats(s, p[2]);
    r.attachments.push(
      {
        "color": "#996600",
        "fields": [
          {
            "value": "#3:   " + GetName(s, p[2]),
            "short": true
          },
          {
            "value": stats[1] + " - " + stats[2] + "            " + stats[0],
            "short": true
          }
        ]
      });
  }

  if (totalPlayers > 3)
  {
    r.attachments.push({"fields": []});
    
    for (i = 2; i < totalPlayers - 1; i++)
    {
      var stats = GetStats(s, p[i + 1]);
      r.attachments[4].fields.push ({
        "value": "#" + (i + 2) + ":   " + GetName(s, p[i + 1]),
        "short": true
      });
      
      r.attachments[4].fields.push ({
        "value": stats[1] + " - " + stats[2] + "            " + stats[0],
        "short": true
      });
    }
  }

  var url = params.response_url;
  var options = {
    "method": "post",
    "content-type": "application/json",
    "payload": JSON.stringify(r)
  }

  UrlFetchApp.fetch(url, options);
  return;
}

function GetPlacements(s, total)
{
  var r = [];
  var end = s.getLastRow();
  var topName = [];
  var allWins = [];
  var allLosses = [];
  var allRatings = [];
  
  for (i = 0; i < total; i++)
  {
    allWins.push(parseInt(GetWins(s, i)));
    allLosses.push(parseInt(GetLosses(s, i)));
    if (allWins[i] + allLosses[i] == 0) allRatings.push(0);
    else allRatings.push(parseFloat(GetRating(s, i)));
  }
  
  while (r.length < total)
  {
    var top = -90000;
    for (i = 0; i < total; i++)
    {
      var next = allRatings[i];
      
      if (next >= top && r.indexOf(i) < 0)
      {
        if (next > top) 
        {
          topName = [];
          top = next;
        }
        topName.push(i);
      }
    }

    if (topName.length > 1)
    {
      var lim = r.length + topName.length;
      while (r.length < lim)
      {
        var tieBreakWins = [];
        var topWins = -1;
        for (i = 0; i < topName.length; i++)
        {
          var next = allWins[topName[i]];
          
          if (next >= topWins && r.indexOf(topName[i]) < 0)
          {
            if (next > topWins) 
            {
              tieBreakWins = [];
              topWins = next;
            }
            tieBreakWins.push(topName[i]);
          }
        }
        
        if (tieBreakWins.length > 1)
        {
          var tieLim = r.length + tieBreakWins.length;
          while (r.length < tieLim)
          {
            var tieBreakGames = [];
            var topGames = -1;
            for (i = 0; i < tieBreakWins.length; i++)
            {
              var nextGames = allLosses[tieBreakWins[i]];
              
              if (nextGames >= topGames && r.indexOf(tieBreakWins[i]) < 0) 
              {
                if (nextGames > topGames)
                {
                  tieBreakGames = [];
                  topGames = nextGames;
                }
                tieBreakGames.push(tieBreakWins[i]);
              }
            }
            
            for (i = 0; i < tieBreakGames.length; i++)
            {
              r.push(tieBreakGames[i]);
            }
          }
        }
        else
        {
          r.push(tieBreakWins[0]);
        }
      }
    }
    else
    {
      r.push(topName[0]);
    }
  }
  
  return r;
}

function GetName(s, val)
{
  var r = s.getRange(1, val * 3 + 1).getValue();
  return CapName(r);
}

function GetRating(s, val)
{
  var r = s.getRange(s.getLastRow(), val * 3 + 1).getValue();
  r = r == "" ? defValue[0]: r;
  return r;
}

function GetWins(s, val)
{
  var r = s.getRange(s.getLastRow(), val * 3 + 2).getValue();
  r = r == "" ? defValue[1]: r;
  if (r < 10) r = r + "   ";
  return r;
}

function GetLosses(s, val)
{
  var r = s.getRange(s.getLastRow(), val * 3 + 3).getValue();
  r = r == "" ? defValue[2]: r;
  if (r < 10) r = "   " + r;
  return r;
}

function GetStats(s, val)
{
  r = [0, GetWins(s, val), GetLosses(s, val)];
  if (parseInt(r[1]) + parseInt(r[2]) != 0) r[0] = Math.round(parseFloat(GetRating(s, val)));
  
  return r;
}

// https://en.wikipedia.org/wiki/Elo_rating_system
// This uses the Elo rating system, with math pulled from the wikipedia page.
function GetK(s, player, games)
{
  var everOver = false;
  for (i = s.getLastRow(); i > 1; i--)
  {
    var rating = s.getRange(i, player * 3 + 1).getValue();
    if (rating >= scoreLimit)
    {
      everOver = true;
      break;
    }
  }
  
  if (everOver) return k[2];
  else if (games >= gameLimit) return k[1];
  else return k[0];
  
}

function AddPlayer(s, newplayer)
{
  if (newplayer.indexOf(" ") > -1)
  {
    var r = {
      "channel": "#" + params.channel_name,
      "text": "_No spaces, please._"
    };
    return r;
  }
  
  if (newplayer.length < 1)
  {
    var r = {
      "channel": "#" + params.channel_name,
      "text": "Usage: _/" + slackCommand + " add [name]_"
    };
    return r;
  }
  
  var end = s.getLastColumn() + 1;
  var bot = s.getLastRow();
  
  for (i = 0; i < end - 1; i += 3)
  {
    if (s.getRange(1, i + 1).getValue() == newplayer)
    {
      var r = {
        "channel": "#" + params.channel_name,
        "text": "_" + CapName(newplayer) + "_ is already registered.",
      }
      return r;
    }
  }
  
  if (s.getLastRow() < 2)
  {
    s.getRange(2, 1).setValue(defValue[0]);
  }
  
  
  for (i = 0; i < 3; i++)
  {
    s.getRange(1, end + i).setValue(newplayer);
  }
  
  var r = {
    "fallback": CapName(newplayer) + " has joined the " + scoreboardTitle + " Power Rankings!",
    "response_type": "in_channel",
    "channel": "#" + params.channel_name,
    "text": "*_A new challenger has appeared!_*",
    "attachments": [
      {
        "color": "good",
        "text": CapName(newplayer) + " has joined the " + scoreboardTitle + " Power Rankings!"
      }
    ]
  };

  if (params.channel_name != slackChannel)
  {
    SendToSlackChannel(r);
    return Confirm(CapName(newplayer) + " successfully added.");
  }
  
  return r;
}

function RemovePlayer(s, newplayer)
{
  var r = {
    "response_type": "ephemeral",
    "channel": "#" + params.channel_name,
    "text": ""
  };
  
  if (params.user_name != adminUser)
  {
    r.text = "_You do not have permission to do that._";
    return r;
  }
  
  if (newplayer.length < 1)
  {
    r.text = "Usage: _/" + slackCommand + " remove [name]_";
    return r;
  }
  
  var end = s.getLastColumn() + 1;
  
  for (i = 0; i < end - 1; i++)
  {
    if (s.getRange(1, i + 1).getValue() == newplayer)
    {
      r.response_type = "in_channel";
      r.text = "_" + CapName(newplayer) + "_ has been removed.";
      s.deleteColumns(i + 1, 3);
      
      if (params.channel_name != slackChannel)
      {
        SendToSlackChannel(r);
        return Confirm(CapName(newplayer) + "has been removed.");
      }
      
      return r;
    }
  }
  
  r.text = "_" + CapName(newplayer) + "_ does not exist.";
  return r;
}

function Undo(s)
{
  var r = {
    "response_type": "ephemeral",
    "channel": "#" + params.channel_name,
    "text": ""
  };
  
  if (params.user_name == adminUser)
  {
    r.response_type = "in_channel";
    r.text = "_Previous match reversed._";
    if (s.getLastRow() > 2) s.deleteRow(s.getLastRow());
    
    if (params.channel_name != slackChannel)
    {
      SendToSlackChannel(r);
      return Confirm("Previous match reversed.");
    }
    
  }
  else
  {
    r.text = "_You do not have permission to do that._";
  }
  
  return r;
}

function ClearSheet(s)
{
  var r = {
    "response_type": "ephemeral",
    "channel": "#" + params.channel_name,
    "text": ""
  };
  
  if (params.user_name == adminUser)
  {
    r.response_type = "in_channel";
    r.text = "_Power Rankings cleared._";
    s.clear();
    
    if (params.channel_name != slackChannel)
    {
      SendToSlackChannel(r);
      return Confirm("Power Rankings cleared.");
    }
    
  }
  else
  {
    r.text = "_You do not have permission to do that._";
  }
  
  return r;
}

function HandleGames(s, txt)
{
  var gamed = false;
  for (i = 0; i < wonWords.length; i++)
  {
    if (txt.indexOf(wonWords[i]) > -1)
    {
      gamed = true;
      break;
    }
  }
  
  if (!gamed) return Help();
  else
  {
    var r = {
      "channel": "#" + params.channel_name,
      "text": ""
    };
    
    var names = txt.split(" ");
    var winner = names[0];
    var loser = names [names.length - 1];
    
    if (winner.length < 1 || loser.length < 1 || names.length < 3 || winner == loser)
    {
      r.text = "Usage: _/" + slackCommand + " [player1] beat [player2]_";
      return r;
    }
    
    var namearray = GetRow(s, 1);
    
    var winPos = namearray.indexOf(winner) / 3;
    var losePos = namearray.indexOf(loser) / 3;
    
    if (winPos < 0)
    {
      r.text = CapName(winner) + " is not a registered player. Add them using _/" + slackCommand + " add " + CapName(winner) + "_ first."
    }
    else if (losePos < 0)
    {
      r.text = CapName(loser) + " is not a registered player. Add them using _/" + slackCommand + " add " + CapName(loser) + "_ first."
    }
    else
    {
      var stats = Score(s, winPos, losePos);
      r = GameMessage(winner, loser, stats);
    }
    
    if (params.channel_name != slackChannel)
    {
      SendToSlackChannel(r);
      return Confirm("Match between " + CapName(winner) + " and " + CapName(loser) + " has been registered.");
    }
    
    return r;
  }
}

function CapName(s)
{
  var r = s.charAt(0).toUpperCase();
  if (s.length > 1) r += s.slice(1);
  return r;
}

function GetRow(s, row)
{
  var r = [];
  for (i = 0; i < s.getLastColumn(); i++)
  {
    r.push(s.getRange(row, i + 1).getValue());
  }
  return r;
}

// https://en.wikipedia.org/wiki/Elo_rating_system
// This uses the Elo rating system, with math pulled from the wikipedia page.
// Returns the ratings for each players, the amount changed, and their respectives wins/losses.
function Score(s, w, l)
{
  var lastRow = s.getLastRow() + 1;
  var lastCol = s.getLastColumn();

  var wRating = parseInt(GetRating(s, w));
  var wWins = parseInt(GetWins(s, w));
  var wLosses = parseInt(GetLosses(s, w));
  
  var lRating = parseInt(GetRating(s, l));
  var lWins = parseInt(GetWins(s, l));
  var lLosses = parseInt(GetLosses(s, l));
  
  var qa = Math.pow(10, wRating / scalar);
  var qb = Math.pow(10, lRating / scalar);
  
  var ca = qa / (qa + qb);
  var cb = 1 - ca;
  
  var wChange = GetK(s, w, wWins + wLosses) * cb;
  var lChange = GetK(s, l, lWins + lLosses) * cb;
  
  wRating += wChange;
  lRating -= lChange;
  
  var change = k * cb;
  
  wWins++;
  lLosses++;
  
  s.getRange(lastRow - 1, 1, lastRow, lastCol).copyTo(s.getRange(lastRow, 1));
  
  s.getRange(lastRow, w * 3 + 1).setValue(wRating);
  s.getRange(lastRow, w * 3 + 2).setValue(wWins);
  
  s.getRange(lastRow, l * 3 + 1).setValue(lRating);
  s.getRange(lastRow, l * 3 + 3).setValue(lLosses);
  
  var r = [Math.round(wRating), wWins, wLosses, Math.round(lRating), lWins, lLosses, Math.round(wChange), Math.round(lChange)];
  
  return r;
}

function GameMessage(win, lose, stats)
{
  var winMessage = wonWords[Math.floor(Math.random() * wonWords.length)];
  
  var r = {
    "response_type": "in_channel",
    "channel": "#" + params.channel_name,
    "text": "*_" + CapName(win) + " " + winMessage + " " + CapName(lose) + "!_*",
    "attachments": [
      {
        "color": "#00DD00",
        "fields": [
          {
            "title": "Winner",
            "value": CapName(win) + "     (" + stats[1] + " - " + stats[2] + ")",
            "short": true
          },
          {
            "title": "New Rating",
            "value": stats[0] + "     (+" + stats[6] + ")",
            "short": true
          }
        ]
      },
      {
        "color": "#DD0000",
        "fields": [
          {
            "title": "Loser",
            "value": CapName(lose) + "     (" + stats[4] + " - " + stats[5] + ")",
            "short": true
          },
          {
            "title": " ",
            "value": stats[3] + "     (-" + stats[7] + ")",
            "short": true
          }
        ]
      }
    ]
  };

  return r;
}

function Help()
{
  var r = {
    "channel": "#" + params.channel_name,
    "attachments": [
      {
        "fields": [
          {
            "title": "top   -   /" + slackCommand + " top",
            "value": "Display the leaderboards"
          },
          {
            "title": "[player1] beat/crushed/wasted/etc [player2]   -   /" + slackCommand + " Andy beat Kevin",
            "value": "Record a game"
          },
          {
            "title": "add [player]   -   /" + slackCommand + " add ArpadElo",
            "value": "Add a player to the Power Rankings"
          },
          {
            "title": "remove [player]   -   /" + slackCommand + " remove KennethHarkness",
            "value": "Remove a player from the Power Rankings"
          },
          {
            "title": "undo   -   /" + slackCommand + " undo",
            "value": "Revert Power Rankings to before the most recent match"
          },
          {
            "title": "clear   -   /" + slackCommand + " clear",
            "value": "Completely clear the Power Rankings"
          }
        ]
      }
    ]
  };
  
  return r;
}

// Used to get around the automatic timeout. Retrieving data from the scoreboard takes too long most of the time,
// so an immediate message is sent to resolve the command, followed by the DelaySend with the appropriate contents.
function DelaySend(msg)
{
  var url = params.response_url;
  var options = {
    "method": "post",
    "content-type": "application/json",
    "payload": JSON.stringify(msg)
  }
  
  UrlFetchApp.fetch(url, options);
  
  return;
}

function SendToSlackChannel(msg)
{
  var r = {
    "fallback": "_/" + slackCommand + " " + params.text + "_",
    "username": params.user_name,
    "text": "_/" + slackCommand + " " + params.text + "_"
  }
  
  var url = incomingURL;
  var options = {
    "method": "post",
    "content-type": "application/json",
    "payload": JSON.stringify(r)
  }
  
  UrlFetchApp.fetch(url, options);
  
  msg.channel = slackChannel;
  options.payload = JSON.stringify(msg);
  
  UrlFetchApp.fetch(url, options);
  
  return;
}

function Confirm(text)
{
  var r = {
    "response_type": "ephemeral",
    "channel": "#" + params.channel_name,
    "text": "_" + text + "_"
  }
  
  return r;
}
