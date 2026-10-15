require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./models/User");

const createUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected!");

    const hashedPassword = await bcrypt.hash(
      "123456",
      10
    );

    const user = await User.create({
      username: "admin",
      password: hashedPassword,
      name: "Admin AIMSlog",
      role: "admin"
    });

    console.log("User created:");
    console.log(user);

    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
};

createUser();