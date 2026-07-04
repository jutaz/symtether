package example

object Pipeline {
  val BatchSize = 100

  def run(items: List[String]): List[String] =
    items.map(transform)

  def transform(item: String): String = item.trim
}

class Stage(name: String) {
  def execute(): Unit = ()
}

trait Retryable {
  def retry(times: Int): Unit
}

case class Event(name: String, payload: String)
