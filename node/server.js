/* Server using Node.js and Express */

/* Node.js standard libraries */
const fs = require("fs")
const path = require("path")

/* NPM libraries */
const express = require("express")

/* Custom libraries */
const database = require("./database/database")

/* Configuration */
const configuration = require("./configuration").express


/* This is the main function of the entire server.
 * It is async so that we can use await inside of it.
 */
const main = async () => {
	// First, load all data
	const loaded = await database.loadData()
	console.log("Loaded data", loaded)

	const app = express()
	app.disable("x-powered-by")
	// Serve static content from webui folder
	const webui = path.join(__dirname, "/../webui")
	const xml =   path.join(__dirname, "/../cache/https-everywhere/src/chrome/content/rules")
	app.use(express.static(webui))
	app.use("/xml/", express.static(xml)) // TODO: add midleware to track release ruleset?

	// Serve dynamic content from "/search?" API endpoint
	app.get("/search?", (request, response) => {
		const targetName = "\%" + request.query.target + "\%"
		if (targetName.length < 6){
			response.send(JSON.stringify({"error" : true}))
		}
		//const query = "SELECT * FROM rulesets WHERE rulesets.rulesetid IN (SELECT rulesetid FROM `ruleset_targets` WHERE `target` LIKE ?);"
		//let targetQuery = 'SELECT * FROM `ruleset_targets` WHERE `target` LIKE \'%' + targetName + '%\''
		const  joinQuery = 'SELECT * FROM ruleset_targets INNER JOIN rulesets ON ruleset_targets.rulesetid=rulesets.rulesetid WHERE ruleset_targets.target LIKE ?;'
		database.query(joinQuery, [targetName]).then((result) => {
			var data = []
			for (const record of result){
				var index = -1
				for (const i in data)
					if (data[i].name === record.name){
						index = i
						break
					}
				if (index === -1){
					index = data.length
					var formatted = {}
					formatted["name"] = record.name
					formatted["file"] = record.file
					formatted["rulesetid"] = record.rulesetid
					if (record.default_off)
						formatted["default_off"] = record.default_off
					if (record.comment)
						formatted["comment"] = record.comment
					if (record.mixedcontent[0] === 1)
						formatted["mixedcontent"] = true
					formatted["targets"] = [record.target]
					data.push(formatted)
				} else {
					data[index].targets.push(record.target)
				}
			}
			response.setHeader("Content-Type", "application/json")
			response.send(JSON.stringify(data))
		})
	})

	app.get("/rulesetinfo?", (request, response) => {
		//targetsQuery also gets the data about if the target supports hsts
		
		console.log("/rulesetinfo? request: ", JSON.stringify(request.query))
		const rulesetid = request.query.rulesetid
		const longList  = [rulesetid, rulesetid, rulesetid, rulesetid, rulesetid, rulesetid]
		const longQuery = "SELECT * FROM rulesets WHERE rulesets.rulesetid=?; \
			SELECT * FROM ruleset_targets WHERE ruleset_targets.rulesetid=?; \
			SELECT * FROM ruleset_rules WHERE ruleset_rules.rulesetid=?; \
			SELECT * FROM ruleset_exclusions WHERE ruleset_exclusions.rulesetid=?; \
			SELECT * FROM ruleset_securecookies WHERE ruleset_securecookies.rulesetid=?; \
			SELECT * FROM ruleset_tests WHERE  ruleset_tests.rulesetid=?;"
		database.query(longQuery, longList).then((data) => {
			const result = {
				"rulesetid": rulesetid,
				"name": data[0][0]["name"],
				"file": data[0][0]["file"],
				"default_off": data[0][0]["default_off"],
				"mixedcontent": data[0][0]["mixedcontent"][0] === 1, // This converts a buffer to boolean
				"comment": data[0][0]["comment"],
				"targets": data[1],
				"rules": data[2],
				"exclusions": data[3],
				"securecookies": data[4],
				"tests": data[5]
			}
			response.setHeader("Content-Type", "application/json")
			response.send(JSON.stringify(result))
		})
	})

	// Serve dynamic content from "/submit_pr?" API endpoint
	app.put("/submit_pr?", (req, response) => {
		var author_id = req.query.author
		var jsondump = req.query.proposed_ruleset
		/*An object containing 
		{
				'ruleset_row': rn_result,
				'securecookies': sc_result,
				'rules': ru_result,
				'exclusions': ex_result,
				'tests': rt_result,
				'targets': tr_result
		} */
		if (targetName.length < 2){
			response.send(JSON.stringify({"error" : true}))
		}
		let putQuery = ''//'SELECT * FROM `ruleset_targets` WHERE `target` LIKE \'%' + targetName + '%\''
			database.query(putQuery, []).then((result) => {
				if(!!!result){
					response.send(JSON.stringify({'status': 'failed'}))
				}
				console.log("Successfully pushed records to database. ")
				response.setHeader("Content-Type", "application/json")
				response.send(JSON.stringify({'status': 'OK'}))
			})
		})

	app.listen(configuration.port, () =>
		console.log(`Server listening on port ${configuration.port}`))
}

// Start server
main()
