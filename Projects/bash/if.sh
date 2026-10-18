#!/bin/bash

mynum=200
# -eq means equal
# -ne means not equal
# -gt means greater then
if [ $mynum -eq 200 ]; then
  echo "the condition is true"
else
  echo "the condition is not true"
fi
