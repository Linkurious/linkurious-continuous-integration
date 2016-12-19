#!/bin/bash

service nginx stop
letsencrypt renew --agree-tos
service nginx start
