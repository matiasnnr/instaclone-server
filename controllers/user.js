const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const awsUploadImage = require('../utils/aws-upload-image');

function createToken(user, SECRET_KEY, expiresIn) {
    const { id, name, email, username } = user;

    const payload = {
        id,
        name,
        email,
        username
    };

    return jwt.sign(payload, SECRET_KEY, { expiresIn })
}

async function getUser(id, username) {
    let user = null;

    if (id) user = await User.findById(id);
    if (username) user = await User.findOne({ username }); // User.findOne({ username: username }); pero como se llaman igual, entonces lo dejamos así

    if (!user) throw new Error("El usuario no existe");

    return user;
}

async function register(input) {
    const newUser = input;

    newUser.email = newUser.email.toLowerCase();
    newUser.username = newUser.username.toLowerCase();

    const { email, username, password } = newUser;

    // revisamos si el email ya existe en la db
    const foundEmail = await User.findOne({ email });

    if (foundEmail) throw new Error('El email ya está en uso');

    // revisamos si el username ya existe en la db
    const foundUsername = await User.findOne({ username });

    if (foundUsername) throw new Error('El nombre de usuario ya está en uso')

    // encryptar password del usuario
    const salt = await bcrypt.genSaltSync(10);
    newUser.password = await bcrypt.hash(password, salt);

    try {
        const user = new User(newUser);
        user.save();
        return user;
    } catch (error) {
        console.log(error);
    }
}

async function login(input) {
    const { email, password } = input;

    const userFound = await User.findOne({ email: email.toLowerCase() });

    if (!userFound) throw new Error('Error en el email o contraseña');

    const passwordSucces = await bcrypt.compare(password, userFound.password);

    if (!passwordSucces) throw new Error('Error en el email o contraseña');

    const userToken = createToken(userFound, process.env.SECRET_KEY, '10d');

    return {
        token: userToken
    };
}

async function updateAvatar(file, ctx) {
    const { id } = ctx.user;
    const { createReadStream, mimetype } = await file;
    const extension = mimetype.split('/')[1];
    const imgName = `avatar/${id}.${extension}`;
    const fileData = createReadStream();

    try {
        const result = await awsUploadImage(fileData, imgName); // url de la imagen subida al s3 de aws
        await User.findByIdAndUpdate(id, { avatar: result })
        return {
            status: true,
            urlAvatar: result,
        }
    } catch (error) {
        console.log(error);
        return {
            status: false,
            urlAvatar: null
        }
    }
}

async function deleteAvatar(ctx) {
    const { id } = ctx.user;
    try {
        await User.findByIdAndUpdate(id, { avatar: '' });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

async function updateUser(input, ctx) {
    const { id } = ctx.user;

    console.log(input);

    try {
        if (input.currentPassword && input.newPassword) {
            // cambiar contraseña
            const userFound = await User.findById(id);
            const passwordSuccess = await bcrypt.compare(input.currentPassword, userFound.password);
            console.log(userFound);
            console.log(passwordSuccess);

            if (!passwordSuccess) throw new Error('Contraseña incorrecta');

            const salt = await bcrypt.genSaltSync(10);
            const newPasswordCrypt = await bcrypt.hash(input.newPassword, salt);

            await User.findByIdAndUpdate(id, { password: newPasswordCrypt });
        } else {
            // cambiar email, description o siteWeb
            await User.findByIdAndUpdate(id, input);
        }
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

async function search(search) {
    const users = await User.find({
        name: { $regex: search, $options: "i" }
    });

    return users
}

module.exports = {
    register,
    getUser,
    login,
    updateAvatar,
    deleteAvatar,
    updateUser,
    search,
}