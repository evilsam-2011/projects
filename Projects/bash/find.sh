#!/bin/bash

# -f means find file
# -d means find directory

if [ -d ~/Downloads/ ]; then
  echo "the file exists"
else
  echo "the file does not exist"
fi
