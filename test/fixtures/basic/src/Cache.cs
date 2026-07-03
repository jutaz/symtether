namespace Example
{
    public interface IEvictionPolicy
    {
        bool ShouldEvict(string key);
    }

    public class Cache
    {
        private readonly int _capacity;

        public Cache(int capacity)
        {
            _capacity = capacity;
        }

        public void Set(string key, object value)
        {
            _ = key;
            _ = value;
        }

        public object Get(string key)
        {
            return key;
        }
    }
}
