defmodule Broker do
  @max_queue 1000

  def publish(topic, message) do
    {topic, message}
  end

  def subscribe(topic) do
    topic
  end

  defp validate(message), do: message
end

defmodule Broker.Consumer do
  def poll(count), do: count
end
