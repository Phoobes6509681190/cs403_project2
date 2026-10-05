const User = require("../models/User");
const bcrypt = require("bcrypt");

exports.createUser = async (req, res) => {
	try {
		const { username, password, name, role = "user" } = req.body;
		if (!username || !password || !name) {
			return res.status(400).json({ success: false, message: "username, password, and name are required" });
		}
		if (!['admin', 'user'].includes(role)) {
			return res.status(400).json({ success: false, message: "role must be admin or user" });
		}
		if (password.length < 8) {
			return res.status(400).json({ success: false, message: "password must be at least 8 characters" });
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const user = await User.create({ username, password: passwordHash, name, role });
		res.status(201).json({
			success: true,
			user: { id: user._id, username: user.username, name: user.name, role: user.role }
		});
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ success: false, message: "Username already exists" });
		}
		res.status(400).json({ success: false, message: error.message });
	}
};

exports.getUsers = async (req, res) => {
	try {
		if (req.user.role !== "admin") {
			return res.status(403).json({ success: false, message: "Admin access required" });
		}

		const users = await User.find()
			.select("name username role")
			.sort({ name: 1 });

		res.json({ success: true, users });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};
