package main

const MaxConnections = 100

type Config struct {
	Timeout int
}

type Server struct {
	config Config
}

func (s *Server) Start() error {
	return nil
}

func (s *Server) Stop() error {
	return nil
}

func NewServer(cfg Config) *Server {
	return &Server{config: cfg}
}
