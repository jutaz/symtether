#include <vector>

namespace math {

class Matrix {
 public:
  Matrix(int rows, int cols) : rows_(rows), cols_(cols) {}

  int rows() const { return rows_; }

  Matrix transpose() const { return Matrix(cols_, rows_); }

 private:
  int rows_;
  int cols_;
};

Matrix identity(int n) { return Matrix(n, n); }

}  // namespace math
