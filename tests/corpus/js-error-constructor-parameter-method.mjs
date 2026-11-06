// The constructor reaches a function through a parameter, after its body is lowered.
function check(Constructor) {
  const error = new Error('message');
  console.log(error.toString === Constructor.prototype.toString);
}
check(Error);
check(TypeError);
check(SuppressedError);
