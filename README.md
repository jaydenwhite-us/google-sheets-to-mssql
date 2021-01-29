CONFIGURATION
--
<ol>
<li> GO TO https://developers.google.com/calendar/quickstart/nodejs</li>
<li> CLICK THE LINK "Enable the Google Calendar API" </li>
<li> COPY CONFIGURATION AND PAST INTO "./credentials.json".<br/> After pasting, the file should resemble the following</li>
</ol>


[<br/>
   {<br/>
    "installed":<br/>
    {<br/>
      "client_id":"",<br/>
      "project_id":""",<br/>
      "auth_uri":"",<br/>
      "token_uri":"",<br/>
      "auth_provider_x509_cert_url":"",<br/>
      "client_secret":"",<br/>
      "redirect_uris":[""]<br/>
    },<br/>
  },<br/>
]

NOTE: "./credentials.json" is an array

4. SPECIFY "custom_designation" and the "sheetID" of the Google Sheet which
can be found in the url. https://docs.google.com/spreadsheets/d/[sheetID]

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
        "sheetID":"""
    },
]


5.) INSTALL NODE and RUN "NODE ." or node index.js from terminal, and follow the directions.


TROUBLESHOOTING
--
6.) Note that Google will throw a 403 permission denied error in the event of an
incorrect query. This can easily cause confusion; so, index.js verifies that a 
data map has been defined inside data_maps.json by the user. Furthermore, index.js 
does not specify data ranges to pull from Google, opting instead to collect
all data from a Google spreadsheet on a sheet by sheet basis. Index.js 

--requests the metadata of a Google spreadsheet specified by sheetID,

--extracts the titles of the child sheets and creates a queue, 

--removes from the queue any sheets that return an undefined or null data_map,

--requests the table data of the sheets by passing the sheet names from the queue as the 
"range:" value,

--removes from the queue any sheets whose headers return undefined or null from
the data map,

--syncs data to SQL table.

EXTERNAL ERROR HANDLING
--
The script does not internally verify the destination tables and column headers 
in the SQL database, nor does it check for proper connection configuration.
These checks are inherently built into SQL databases and the mssql dependency
respectively, so an error message is already returned to index.js whenever a request fails.
It is because of Google's lack of error documentation that a portion of index.js is
devoted to resolving potential errors.




 
 