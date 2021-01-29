
1.) GO TO https://developers.google.com/calendar/quickstart/nodejs</li>
2.) CLICK THE LINK "Enable the Google Calendar API" </li>
3.) COPY CONFIGURATION AND PAST INTO "./credentials.json".<br/> After pasting, the file should resemble the following.

[
   {
    "installed":
    {
      "client_id":"",
      "project_id":""",
      "auth_uri":"",
      "token_uri":"",
      "auth_provider_x509_cert_url":"",
      "client_secret":"",
      "redirect_uris":[""]
    },
  },
]

NOTE: "./credentials.json" is an array.

4.) SPECIFY "custom_designation", "file_path", and query
[
    {
        "installed":
        {
          "client_id":"",
          "project_id":""",
          "auth_uri":"",
          "token_uri":"",
          "auth_provider_x509_cert_url":"",
          "client_secret":"",
          "redirect_uris":[""]
        },
        "custom_designation": "",
        "file_path": "./workCalendar.csv",
        "query":{
          "calendarId": "primary",
          "timeMin": "2020-01-01T00:00:00+00:00",
          "timeMax": "2020-06-01T00:00:00+00:00",
          "maxResults": 500,
          "singleEvents": true,
          "orderBy": "startTime",
          "pageToken": null
        }
    },
]

5.) INSTALL NODE
6.) RUN "node ." or "node index.js" from terminal
7.) For the first time through, follow the onscreen directions to initialize tokens.
---for full list of possible request parameters see bottom of index.js or visit https://developers.google.com/calendar/v3/reference