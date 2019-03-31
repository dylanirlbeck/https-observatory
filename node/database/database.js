"use strict"

/* Node.js standard libraries */
const fs = require("fs")
const { promisify } = require("util")
const { basename } = require("path")

/* NPM libraries */
const sql = require("mysql")
const json5 = require("json5")
const { parseString } = require("xml2js")
const glob = require("glob")
const punycode = require("punycode")
// Wrap libraries into promisses
const parseStringPromise = promisify(parseString)
const globPromise = promisify(glob)
const readFilePromise = promisify(fs.readFile)

/* Custom libraries */
const updateRecords = require("./git.js")

/* Configuration */
const configuration = require("../configuration.json").database

// Where database state file is
const state_file_path = __dirname + "/" + configuration.state

const credentials = configuration.connection

if (credentials.password === "" || credentials.password === undefined || credentials.password === null)
  console.warn("YOU SHOULD SET A PASSWORD ON THE DATABASE")

const connection = sql.createConnection(credentials)

connection.connect((error) => {
  if (error)
    console.error("Failed to connect to the database")
  else
    console.log("Connected to database")
})

/* Checks if database responds to a ping */
const isOnline = async (query, args) => {
  return new Promise((resolve, reject) => {
    connection.ping((error) => {
      if (error)
        reject(error)
      else
        resolve(true)
    })
  })
}

const queryPromise = async (query, args) => {
  return new Promise((resolve, reject) => {
    connection.query(query, args, function (error, results, fields) {
      if (error){
        console.log(error)
        console.log(results)
        console.log(fields)
        reject([error, results, fields])
      }
      else resolve(results)
    })
  })
}

/* Loads all HSTS records from a Chromium list */
const loadDataHSTS = async() => {
  return new Promise(function(resolve, reject) {
    const path = __dirname + "/../../cache/transport_security_state_static.json"
    // Can't just require(path) or "JSON.parse(...) because file contains coments
    // Use JSON5 instead (that supports comments)
    // Also, we care only about entries (not pinsets)
    const data = json5.parse(fs.readFileSync(path)).entries

    let formated_hsts = []
    for (const record of data){
      formated_hsts.push([
        record.name,
        record.policy,
        record.include_subdomains,
        record.include_subdomains_for_pinning,
        record.mode === "force-https",
        record.pins,
        record.expect_ct_report_uri ? record.expect_ct_report_uri : null
      ])
    }
    connection.query("INSERT INTO evidence_hsts_preload (name, policy, include_subdomains, include_subdomains_for_pinning, force_https, pins, expect_ct_report_uri) VALUES ?", [formated_hsts],
    function (error, results, fields) {
      if (error){
        console.log(error, results, fields)
        reject(false)
      } else {
        console.log("Database: Inserted all HSTS preload records")
        resolve(true)
      }
    })
  })
}

const loadDataRules = async (path) => {
  const files = await globPromise(path)

  let formated_rulesets   = []
  let formated_targets    = []
  let formated_rules      = []
  let formated_tests      = []
  let formated_exclusions = []
  let formated_cookies    = []

  // TODO: Query the correct rulesetid from the database
  // when inserting into database that already has records
  let rulesetid = 0
  for (const file of files) {
    const contents = await readFilePromise(file, "utf8")

    const ruleset = (await parseStringPromise(contents)).ruleset
    rulesetid += 1

    if (ruleset.$.platform && ruleset.$.platform !== "mixedcontent")
      console.error(`Unknown platform ${ruleset.$.platform}, ignored it`)
    formated_rulesets.push([                       // Record attributes:
      rulesetid,                             // INT rulesetid
      ruleset.$.name,                        // VARCHAR name
      basename(file),                        // VARCHAR file
      ruleset.$.default_off,                 // VARCHAR default_off
      ruleset.$.platform === "mixedcontent"  // BIT mixedcontent
    ])

    for (const target of ruleset.target){
      const host = punycode.toASCII(target.$.host) // Convert to punycode, if needed
      formated_targets.push([rulesetid, host])
    }

    for (const rule of ruleset.rule){            // Should fail if there are no rules
      // TODO: punycode, if there is any
      formated_rules.push([ // Record attributes:
        rulesetid,          // INT rulesetid
        rule.$.from,        // VARCHAR from
        rule.$.to           // VARCHAR to
      ])
    }

    for (const test of ruleset.test || []){      // Should move on if there are no tests
      formated_tests.push([ // Record attributes:
        rulesetid,          // INT rulesetid
        test.$.url          // VARCHAR url
      ])
    }

    for (const exclusion of ruleset.exclusion || []){ // Should move on if there are no tests
      formated_exclusions.push([ // Record attributes:
        rulesetid,               // INT rulesetid
        exclusion.$.pattern      // VARCHAR url
      ])
    }

    for (const cookie of ruleset.securecookie || []){ // Should move on if there are no tests
      formated_cookies.push([ // Record attributes:
        rulesetid,            // INT rulesetid
        cookie.$.host,        // VARCHAR url
        cookie.$.name         // VARCHAR url
      ])
    }
  }

  connection.query("INSERT INTO rulesets (`rulesetid`, `name`, `file`, `default_off`, `mixedcontent`) VALUES ?", [formated_rulesets],
    function (error, results, fields) {
      if (error)
        console.log(error, results, fields)
      else
        console.log("Database: Inserted all rulesets' unique attributes")
    })


  connection.query("INSERT INTO ruleset_targets (`rulesetid`, `target`) VALUES ?", [formated_targets],
    function (error, results, fields) {
      if (error)
        console.log(error, results, fields, error)
      else
        console.log("Database: Inserted all rulesets' targets")
    })

  connection.query("INSERT INTO ruleset_rules (`rulesetid`, `from`, `to`) VALUES ?", [formated_rules],
    function (error, results, fields) {
      if (error)
        console.log(error, fields)
      else
        console.log("Database: Inserted all rulesets' rules")
    })

  connection.query("INSERT INTO ruleset_tests (`rulesetid`, `url`) VALUES ?", [formated_tests],
    function (error, results, fields) {
      if (error)
        console.log(error, fields)
      else
        console.log("Database: Inserted all rulesets' tests")
    })


  connection.query("INSERT INTO ruleset_exclusions (`rulesetid`, `pattern`) VALUES ?", [formated_exclusions],
    function (error, results, fields) {
      if (error)
        console.log(error, fields)
      else
        console.log("Database: Inserted all rulesets' exclusions")
    })

  connection.query("INSERT INTO ruleset_securecookies (`rulesetid`, `host`, `name`) VALUES ?", [formated_cookies],
    function (error, results, fields) {
      if (error)
        console.log(error, fields)
      else
        console.log("Database: Inserted all rulesets' securecookies")
    })

}

const loadData = async () => {
  // The tate of the database
  let state
  const path_data = __dirname + "/../../cache/https-everywhere/src/chrome/content/rules/*.xml"

  // Attempt to load the file state of the database, which might not exist
  try {
    state = require(state_file_path)
    console.log(`Loaded database state file found at ${state_file_path}.`)
  } catch(error) {
    // State
    // TODO: async to make sure all these returned before moving on
    console.log(`No valid database state file found at ${state_file_path}, emptying the database and loading new data.`)
    // Delete all ruleset data.
    // We need to delete records only from `rulesets` table, since all child records will be deleted automatically.
    connection.query("DELETE FROM rulesets;")
    // Delete HSTS Preload records
    connection.query("DELETE FROM evidence_hsts_preload;")
    console.log("emptied everything")
    // TODO

    console.log("Database: Started loading data...")
    await loadDataHSTS()
    await loadDataRules(path_data)
    console.log("Database: Done loading data.")
  }

  // Check if database is connected
  const online = await isOnline()
  if (!online)
    return false
  console.log("Database is connected and initialized")
  // set a timer to periodically check for HTTPSE git repo updates
  updateRecords.checkOnTimer(connection, loadDataRules)
  return true
}

module.exports = {
  isOnline: isOnline,
  query: queryPromise,
  loadData: loadData
}
