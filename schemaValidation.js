const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).required(),
  price: Joi.number().min(50).required(),
  location: Joi.string().required(),
  country: Joi.string().required()
});