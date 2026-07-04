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
- [struct field](../src/legacy.c#sym:buf.len)

C++:

- [transpose](../src/matrix.cpp#sym:Matrix.transpose)
- [identity](../src/matrix.cpp#sym:fn:identity)
- [namespace](../src/matrix.cpp#sym:type:math)
- [qualified method](../src/matrix.cpp#sym:math.Matrix.rows)

C#:

- [cache set](../src/Cache.cs#sym:Cache.Set)
- [eviction policy](../src/Cache.cs#sym:type:IEvictionPolicy)
- [capacity field](../src/Cache.cs#sym:const:_capacity)
- [constructor](../src/Cache.cs#sym:fn:Cache.Cache)

PHP:

- [dispatch](../src/router.php#sym:Router.dispatch)
- [factory](../src/router.php#sym:fn:make_router)

Kotlin:

- [find by id](../src/Repository.kt#sym:Repository.findById)
- [top-level helper](../src/Repository.kt#sym:fn:topLevelHelper)
- [max results](../src/Repository.kt#sym:const:MAX_RESULTS)
- [row mapper](../src/Repository.kt#sym:type:RowMapper)
- [connection pool](../src/Repository.kt#sym:class:ConnectionPool)
- [pool acquire](../src/Repository.kt#sym:ConnectionPool.acquire)
- [status enum](../src/Repository.kt#sym:type:Status)

Bash:

- [packaging](../src/release.sh#sym:fn:package_artifacts)
- [publish fn-keyword form](../src/release.sh#sym:fn:publish_release)
- [channel variable](../src/release.sh#sym:const:RELEASE_CHANNEL)

Scala:

- [pipeline run](../src/pipeline.scala#sym:Pipeline.run)
- [stage class](../src/pipeline.scala#sym:class:Stage)
- [retryable trait](../src/pipeline.scala#sym:type:Retryable)
- [event case class](../src/pipeline.scala#sym:class:Event)

Elixir:

- [publish](../src/broker.ex#sym:Broker.publish)
- [private validate](../src/broker.ex#sym:fn:validate)
- [nested module fn](../src/broker.ex#sym:Consumer.poll)

Lua:

- [scheduler add](../src/scheduler.lua#sym:Scheduler.add)
- [constructor](../src/scheduler.lua#sym:fn:new)
- [local helper](../src/scheduler.lua#sym:fn:default_clock)

Broken (each language reports symbol-level failures):

- [gone go fn](../src/server.go#sym:Restart)
- [gone rust fn](../src/parser.rs#sym:Parser.reset)
