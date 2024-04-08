#!/bin/bash

WHERE_AM_I=$(pwd)
printf "\nThis will add a line to your ~/.bashrc , which makes any and all scripts in $WHERE_AM_I available to your terminal session(s)"
printf "\nContinue? (Y/N)\n"
read answer
ANSWER=$answer
case $ANSWER in
	y|Y|yes|YES)
		printf "\nexport PATH=$WHERE_AM_I:\$PATH" >> ~/.bashrc
		printf "\nOkay, now you must restart your terminal session, or type in 'source ~/.bashrc'  in order to use these scripts\n"
	;;
	n|N|no|NO)
		printf "\nexiting.  No modifications to your ~/.bashrc were made"
	;;
esac
