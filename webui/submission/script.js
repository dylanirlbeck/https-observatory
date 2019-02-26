"use strict"

var rulesetid;

const strings = {
    "securecookies": {
        "title": "Secure Cookies",
        "subtitle": "These define the cookies that should be secured"
    }
}

const displayData = (data) => {
    document.getElementById("name").value = data.name
    document.getElementById("file").value = data.file
    document.getElementById("mixedcontent").checked = data.mixedcontent
    // TODO: default_off

    for (const type of ["targets", "rules", "exclusions", "securecookies"]){
        const list = document.getElementById(type)
        const array = data[type]
        if (!array)
            continue
        for (const record of array){
            const node = addElement(list)
            for (const attribute in record){
            	const input = node.querySelector("INPUT[name='"+attribute+"']")
            	if (input)
            		input.value = record[attribute]
            }
        }
    }
    console.log("displayData finished")
}

/* Use new thing */
const queryData = (rulesetid) => {    
    if (!!rulesetid) {
        const url = "/rulesetinfo?rulesetid=" + rulesetid
        // console.log(url)

        fetch(url)
        .then((response) => {   // Check if fetch suceeded and extract the data
            if (response.ok) {
                console.log("Response received")
                return response.json()
            } else {
                return Promise.reject(new Error("Search request failed"))
            }
        }).then((data) => {
		    displayData(data)
		    console.log(data.file)
		    if (data.file)
				queryXML(data.file)
        })
        .catch((error) => console.log("failed to display data", error))
    }
}

const queryXML = (filename) => {    
    if (!!filename) {
        const url = "/xml/" + filename

        fetch(url)
        .then((response) => {   // Check if fetch suceeded and extract the data
            if (response.ok) {
                console.log("XML received")
                return response.text()
            } else {
                return Promise.reject(new Error("XML unavailable at " + url))
            }
        }).then((xml) => {
		    document.getElementById("xml").innerText = xml//response.text()//"some"//xml
        })
        .catch((error) => console.log("failed to display XML"))
    }
}


const loadPage = async () =>{
	const url_string = window.location.href
	const url = new URL(url_string)
	const rulesetid = url.searchParams.get("rulesetid")
	console.log(rulesetid)
	queryData(rulesetid)
	// TODO: use History API to display nice URL
}

function formToJSON(){

	const ruleset_data = {
		"rulesetid": rulesetid,
		"name": document.getElementById("name").value,
		"file": document.getElementById("file").value,
		"default_off": document.getElementById("default_off").value,
		"mixedcontent": document.getElementById("mixedcontent").value,
		"comment": null,
		"targets": ["example.com", "*.example.com"],
		"rules": [
			{
				"from": "^http://",
				"to": "https://"
			},
			{
				"from": "http://www.example.com",
				"to": "https://example.com"
			}
		],
		"exclusions": [
			{
				"pattern": "example.com/example",
				"comment": "insecure urls"
			}
		],
		"securecookies": [
			{
				"host":"example.com",
				"name":".+",
				"comment":"all"
			}
		]
	}
}

/* Code below handles "Add" and "Delete" button clicks */

/* This deletes a specified element from a lists of attributes (if allowed) */
function deleteElement(button){
	const li = button.parentNode
	const ul = li.parentNode
    console.log("ul", ul)
	const minCount = ul.hasAttribute("min-count") ? ul.getAttribute("min-count") : 0
    const currCount = ul.getElementsByTagName("LI").length - 1 // Remember about the prototype node
    console.log(currCount)
	if (currCount > minCount){
		li.parentNode.removeChild(li)
		console.log("removed node")
	} else {
		console.log("Too few children")
	}
}

/* This adds an empty element to lists of attributes that can have multipl elements */
function addElement(ul){
    try {
        const node = ul.getElementsByTagName("LI")[0].cloneNode(true)
        node.removeAttribute("id")
        ul.appendChild(node)
        return node
    } catch (e){
        console.log("Could not add element")
    }
}

/* Initialize the document with event handlers */
const init = () => {
	document.addEventListener("click", (event) => {
		/* "Add" button */
		if (event.target.classList.contains("btn-add")){
            const dl = event.target.parentNode.parentNode.parentNode
            const ul = dl.getElementsByTagName("UL")[0]
			addElement(ul)
        }
		/* "Delete" button */
		if (event.target.classList.contains("btn-delete"))
			deleteElement(event.target)
	})
}

/* Initialize all scripts upon page load */
if( document.readyState !== "loading" ) {
    /* document is already ready, just execute code now */
    init()
    loadPage()
} else {
    document.addEventListener("DOMContentLoaded", init)
}
