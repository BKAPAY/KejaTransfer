#!/bin/bash
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install
