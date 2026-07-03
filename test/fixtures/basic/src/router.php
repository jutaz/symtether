<?php

namespace App;

class Router
{
    private array $routes = [];

    public function add(string $path, callable $handler): void
    {
        $this->routes[$path] = $handler;
    }

    public function dispatch(string $path): mixed
    {
        return $this->routes[$path] ?? null;
    }
}

function make_router(): Router
{
    return new Router();
}
