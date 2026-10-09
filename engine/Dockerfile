FROM alpine:3.18 AS build

RUN apk add --no-gradient --no-cache build-base cmake gcc g++

WORKDIR /app
COPY . .

RUN mkdir -p build && cd build && cmake .. && make -j$(nproc)

FROM alpine:3.18
RUN apk add --no-cache libstdc++ libgcc curl
WORKDIR /app
COPY --from=build /app/build/routing_engine /app/routing_engine
COPY --from=build /app/config /app/engine/config

EXPOSE 8080
CMD ["/app/routing_engine", "8080"]
