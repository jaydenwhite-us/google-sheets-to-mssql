const fs = require('fs');
const {google} = require('googleapis');

const TOKENS_PATH = 'tokens.json';
const tokens = require("./" + TOKENS_PATH);

const credentials = require("./credentials.json");
const data_maps = require("./data_maps.json");
// If modifying these scopes, delete tokens.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file tokens.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

//SQL Database connection
const mssql = require('mssql');
const sql_config = require("./sql_config.json");
const global_connection = mssql.connect(sql_config);


// Load client secrets from a local file.
//This is the "main" function. It importS the Credentials, authorizes with oAuth2, and runs the script migrate.
async function main(){
    const tokens_obj = await tokens;
    const credential_array = await credentials;
    let connection = await global_connection.catch((err)=>{
        console.error(err);
    });

    for await (const credentials of credential_array){
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        const designation = credentials["custom_designation"];
        const oAuth2Client = await new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        if(tokens_obj.hasOwnProperty(designation)){
            oAuth2Client.setCredentials(tokens[designation]);
            await migrate(oAuth2Client, credentials, connection).catch((err)=>{
                console.error(err);
            });
        }else {
            let token = await customGetAccessToken(oAuth2Client, credentials);
            await oAuth2Client.setCredentials(token);
            migrate(oAuth2Client, credentials, connection).catch((err) => {
                console.error(err);
            });
            await customStoreAccessToken(token, designation);
        }
    }
}


main().catch((err)=>{
    if(err)console.error(err);
});

/**
 * Get and store new token after prompting for user authorization.
 */
async function customGetAccessToken(oAuth2Client, credentials) {
    const {client_id, redirect_uris} = credentials.installed;

    const authUrl = oAuth2Client.generateAuthUrl({
        client_id: client_id,
        redirect_uri: redirect_uris[0],
        response_type: "code",
        access_type: 'offline',
        scope: SCOPES,
    });

    const readline = require('readline');
    const { promisify } = require('util');

    readline.Interface.prototype.question[promisify.custom] = function(prompt) {
        return new Promise(resolve =>
            readline.Interface.prototype.question.call(this, prompt, resolve),
        );
    };
    readline.Interface.prototype.questionAsync = promisify(
        readline.Interface.prototype.question,
    );


    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let answer = await rl.questionAsync('Enter the code from that page here: ');

    rl.close();
    let response = await oAuth2Client.getToken(answer);
    return response.tokens;
}

function customStoreAccessToken(token, designation){
    const tokens = require("./tokens.json");
    tokens[designation] = token;
    // Store the revised token map to disk for later program executions
    fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, "\t"), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKENS_PATH);
    });
}



async function migrate(auth, credentials, sql) {

    //GET DATA from GOOGLE SHEETS
    const sheetClient = await google.sheets({version: 'v4', auth: auth});

    //GET SpreadSheet metadata
    const test_resp = await sheetClient.spreadsheets.get({ spreadsheetId:credentials.sheetID});

    let queue = test_resp.data.sheets;

    //CHECK for undefined data maps. Remove from queue
    const symbols = ['\u2713\t\t\t\t\t\t', 'x\tREMOVED FROM QUEUE\t'];
    console.log("DATA MAP EXISTENCE CHECKS:\n\t(Tables with undefined DATA MAPS will be removed from the queue.)");
    for(let index = queue.length-1; index >=0; index --){
        const sheet = queue[index];
        const title = sheet.properties.title;
        const zero_neg_one = (!data_maps[title]*1); //Check for defined data map. Convert to 0 or 1
        console.log("\t"+ symbols[zero_neg_one] + " "+ title); //Print x or check mark
        queue.splice(index, zero_neg_one,); //Remove from queue if zero_neg_one equals 1
    }

    //GET data sheets one at a time. Return as a map of promises [title, resp]
    let promises = queue.map(async(sheet)=>{
        const title = sheet.properties.title;
        const resp = await sheetClient.spreadsheets.values.get({
            spreadsheetId:credentials.sheetID,
            range: title,
            majorDimension: "ROWS",
        }).catch((resp)=>{
            console.log(JSON.stringify(resp.errors, null, 4));
            return Promise.reject([title, JSON.stringify(resp.errors)]);
        });
        return [title,resp];
    });



    const header_check_symbols = ['x\tMAPPING UNDEFINED\t', '\u2713\t\t\t\t\t\t'];
    const actions = [ "PASSED", 'REMOVED FROM QUEUE',];
    //CHECK for undefined header mappings.
    queue = await Promise.allSettled(promises);

    for(let index = queue.length-1; index >=0; index--){
        const [title, sheet] = [queue[index].value[0], queue[index].value[1].data.values];
        const headers = Array.from(sheet[0]);

        let error_count = headers.length;
        let section_1 = '';
        let section_2 = '';
        let section_3 = '';

        //CHECK for undefined header mappings.
        for(const header of headers){
            const zero_neg_one = !!data_maps[title][header]*1; //Check for defined data map. Convert to Boolean. Implicit coercion of Boolean to 0 or 1;
            error_count -= zero_neg_one; //Decrement error count.
            section_2 += '\t'+ header_check_symbols[zero_neg_one] + '\''+ header + '\'\n';
        }

        //DETERMINE action.
        const action_code = !!error_count*1;
        section_1 +='---' + '\nHEADER CHECKS: '+ actions[action_code] +'\n\'' +  title + '\'\n';
        section_3 += 'Error Count: '+ error_count + '\n';
        queue.splice(index, action_code);

        //LOG results
        console.log(section_1, section_2, section_3);
    }


    for await (const [index, sheet] of queue.entries()){
        let sheet = queue[index].value[1].data.values;

        const sheet_name = queue[index].value[0]; //Google sheet_name
        const headers = Array.from(sheet[0]);
        const rows = sheet;
        rows.shift();
        const table_name = await data_maps[sheet_name].table_name; //SQL table name
        console.log('\n---','UPDATING', table_name);
        const type_query = "select COLUMN_NAME, DATA_TYPE from INFORMATION_SCHEMA.COLUMNS where TABLE_NAME = '" + table_name + "\'";
        const type_resp = await sql.query(type_query);

        let data_types = { };

        //Acquire column types for type conversion.
        for await(const row of type_resp.recordset){
            data_types[row.COLUMN_NAME] = row.DATA_TYPE;
            if(row.DATA_TYPE === "numeric"){
                let action = "ALTER TABLE " + table_name + " ALTER COLUMN " + row.COLUMN_NAME + " numeric(18,4)";
                await sql.query(action);
            }
        }

        //PREP table for update.
        /*await columns(sql, table_name);
        await truncate(sql, table_name);*/

        let select_statement = "select ";
        for(const header of headers){ select_statement += data_maps[sheet_name][header] + ", "; };
        select_statement = select_statement.substring(0, select_statement.length-2);

        const general_query = select_statement + " FROM " + table_name;

        //WRAP data into SQL queries
        let strings = rows.map((row)=>{
            let string = 'IF NOT EXISTS (' + select_statement + " FROM " + table_name;
            let where_statement = " WHERE ";
            let columns = " (";
            let values = " VALUES (";

            for(let i = 0; i < row.length; i++){
                const column = data_maps[sheet_name][headers[i]];
                let value = row[i];
                const type = data_types[column];

                if(type ==="numeric" && (value === "" || value === '')) value = "0";
                if(type === "numeric"){
                    value = value.replace(/[\$,]/g, '');
                    value = "CONVERT( " + "numeric(18,4)" + ", \'" + value + "\')";
                }else{
                    value = value.replace(/'/g, "''");
                    value = "CONVERT( " + type + ", \'" + value + "\')";
                }

                where_statement +=  column + " = " + value;
                columns += column;
                values += value;

                if(i !== row.length-1) {
                    where_statement += " AND ";
                    columns += ", ";
                    values += ", ";
                }
            }

            string = string + where_statement + ") ";
            columns += ") ";
            values += ") ";

            const procedure = "BEGIN INSERT INTO " + table_name + columns + values + " END";
            string += procedure;
            return string;
        });

        //SEND data to SQL database
        for await(const string of strings){
            sql.query(string, (err, data)=>{
                if(err) {
                    console.log(string);
                    console.log(err);
                }
            });
        }

        console.log('COMPLETE');
        /*
        await sql.query(general_query, (err, data)=>{
            if(err) console.log(err);
            else console.log(table_name, data);
        });*/
    }
}


async function columns(connection, table){
    let general = "select COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE from INFORMATION_SCHEMA.COLUMNS where TABLE_NAME = \'" + table + "\'";
    await connection.query(general, (err, data)=>{
        if(err)console.log(err);
        else;
    });
}

async function truncate(connection, table){
    let d_query = "TRUNCATE TABLE " + table;
    connection.query(d_query, (err, data)=>{
        if(err) console.log(err);
        else;
    });
}
