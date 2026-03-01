const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const repository = require("../repositories/usersRepository");

async function register({ name, email, password }) {
  const userExists = await repository.findUserByEmail(email);

  if (userExists) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await repository.createUser({
    name,
    email,
    password: hashedPassword,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

async function login({ email, password }) {
  const user = await repository.findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    token,
  };
}

module.exports = {
  register,
  login,
};