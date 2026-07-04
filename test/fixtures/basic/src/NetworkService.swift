import Foundation

let defaultTimeout = 30

struct Endpoint {
    var path: String

    func absoluteURL(host: String) -> String {
        return host + path
    }
}

class NetworkService {
    let session: String

    init(session: String) {
        self.session = session
    }

    func request(_ endpoint: Endpoint) -> String {
        return endpoint.path
    }
}

protocol Cancellable {
    func cancel()
}

enum ConnectionState {
    case idle
    case active
}

func makeService() -> NetworkService {
    return NetworkService(session: "default")
}
