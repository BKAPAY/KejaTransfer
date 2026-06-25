#!/bin/bash
npm cache clean --force
npm config set registry https://registry.npmjs.org/ --global
npm install --legacy-peer-deps
