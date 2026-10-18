#!/bin/bash

htop=/usr/bin/htop

if [ -f $htop ]; then
  echo "$htop is installed"
else
  echo "$htop is not installed isntalling it.."
  sudo dnf install htop
fi

$htop
