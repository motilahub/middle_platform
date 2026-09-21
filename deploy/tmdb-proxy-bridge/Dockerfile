FROM alpine:3.22

RUN apk add --no-cache socat

COPY entrypoint.sh /usr/local/bin/tmdb-proxy-bridge
RUN chmod 755 /usr/local/bin/tmdb-proxy-bridge

ENTRYPOINT ["tmdb-proxy-bridge"]
