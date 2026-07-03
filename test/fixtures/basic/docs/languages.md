# Tier-1 language coverage

Go:

- [server start](../src/server.go#sym:Server.Start)
- [constructor](../src/server.go#sym:fn:NewServer)
- [max connections](../src/server.go#sym:const:MaxConnections)
- [config type](../src/server.go#sym:type:Config)
- [struct field](../src/server.go#sym:Config.Timeout)

Rust:

- [parser method](../src/parser.rs#sym:Parser.parse)
- [tokenize](../src/parser.rs#sym:fn:tokenize)
- [depth limit](../src/parser.rs#sym:const:MAX_DEPTH)
- [token enum](../src/parser.rs#sym:type:Token)

Java:

- [rev method](../src/Engine.java#sym:Engine.rev)
- [redline listener](../src/Engine.java#sym:type:Listener)
- [max rpm](../src/Engine.java#sym:const:MAX_RPM)

Ruby:

- [worker perform](../src/worker.rb#sym:Worker.perform)
- [module method](../src/worker.rb#sym:fn:enqueue)
- [retry limit](../src/worker.rb#sym:const:RETRY_LIMIT)

C:

- [append](../src/legacy.c#sym:fn:buffer_append)
- [static helper](../src/legacy.c#sym:buffer_grow)

C++:

- [transpose](../src/matrix.cpp#sym:Matrix.transpose)
- [identity](../src/matrix.cpp#sym:fn:identity)

C#:

- [cache set](../src/Cache.cs#sym:Cache.Set)
- [eviction policy](../src/Cache.cs#sym:type:IEvictionPolicy)

PHP:

- [dispatch](../src/router.php#sym:Router.dispatch)
- [factory](../src/router.php#sym:fn:make_router)

Broken (each language reports symbol-level failures):

- [gone go fn](../src/server.go#sym:Restart)
- [gone rust fn](../src/parser.rs#sym:Parser.reset)
