#!/bin/bash

###############
### Check for an empty first argument
###############
if [[ $1 = '' ]]; then
	printf "\nYou must run this script by invoking it, and then a space, and then a URL for the bot to use\n"
	exit 0
fi


################
### Run the Bot
################
cd /home/$USER/winterwell/wwappbase.js/test-base
npm i
babel-node refreshBot9000 --url $1
