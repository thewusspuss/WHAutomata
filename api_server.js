const express = require('express');
let models = require('./models');
let app = express();
app.use(express.urlencoded({
	extended: true
}));
app.use(express.json());
app.locals.db = models.mongoose.connection;
app.locals.db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// API server that could be hosted on cloud
// We should probably convert index.js's functions to just use these

app.get('/products', (req, res) => {
	// console.log(req.query);
	// GET products. Give url query containing name, batch, expiry
	// Will match and return a list of products matching that query
	// If no params are given then returns all products
	query = {}
	if ("name" in req.query) {
		query.name = req.query.name
	}
	if ("batch" in req.query) {
		query.batch = req.query.batch
	}
	if ("expiry" in req.query) {
		query.expiry = req.query.expiry
	}

	models.Product.find(query)
		.then(products => {
			res.send({products})
		})
		.catch(err => {
			console.error(err);
			res.status(500).send({
				message: 'A server side error has occured'
			})
		})
})

app.get('/stacks', (req, res) => {
	query = {}
	if ("x" in req.query) {
		query.x = req.query.x
	}
	if ("y" in req.query) {
		query.y = req.query.y
	}
	models.Stack.find(query)
		.then(stacks => {
			res.send({
				stacks
			})
		})
		.catch(err => {
			console.error(err);
			res.status(500).send({
				message: 'A server side error has occured'
			})
		})
})

app.post('/addProductsToStack', (req, res) => { // This name sucks. Suggest a better one
	var product_id = req.body.product_id
	var stack = {
		x: req.body.x,
		y: req.body.y
	}
	req.body.count = req.body.count || 1
	// console.log(typeof req.body.count);
	req.body.count = parseInt(req.body.count)
	if (!req.body.count) {
		res.status(400).send('Bad')
		return
	}
	Promise.all([
			models.Product.findOne({
				_id: product_id
			}),
			models.Stack.findOne(stack)
		])
		.then(([product, stack]) => {
			console.log(product);
			console.log(stack);
			
			if (product && stack) {
				models.StackProductMap.findOne({
						product: product._id,
						stack: stack._id
					})
					.then(map => {
						if (map) {
							let new_count = map.count + req.body.count
							if (new_count < 1) {
								return models.StackProductMap.deleteOne(map)
							}
							map.count = new_count
							return map.save()
						} else {
							if (req.body.count < 1) {
								return
							}
							return new models.StackProductMap({
								product: product._id,
								stack: stack._id,
								count: req.body.count
							}).save()
						}
					})
					.then(map => {
						res.send({
							message: 'Success',
							map
						})
					})
			} else {
				res.status(400).send({
					message: 'Unable to find both product and stack',
					product,
					stack
				})
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).send({
				message: 'A server side error has occured'
			})
		})
})

app.get('/products/:id', (req, res) => {
	// return product mathing id parameter

	var id = req.params.id;
	//extract product details based on the id
	models.Product.findOne({
		_id: id
	})
	.then(product => {
		// res.render('productDetails', {product,stackmapdetails})
		res.send({product})
	})
	.catch(err => {
		console.error(err);
		res.status(500).send({
			message: 'A server side error has occured'
		})
	})
})

app.post('/products', (req, res) => {
	// Try to add a new product
	// name and batch required. expiry is optional
	// returns 400 if invalid request
	// 201 returns a message, id and uri pointing to the created resource
	// 303 if product already exists along with uri to existing product
	// should we also add proper status messages?
	// like ok: 1 or ok: 0

	var prod = {
		name: req.body.name,
		batch: new Date(req.body.batch)
	}
	if (req.body.expiry) {
		prod.expiry = req.body.expiry
	}
	prod = new models.Product(prod)
	var validation_errors = prod.validateSync()
	if (validation_errors) {
		res.statusCode(400).send({
			message: 'Improper form data'
		});
	} else {
		// console.log(prod)
		models.Product.findOne({
				name: prod.name,
				batch: prod.batch
			})
			.then(product => {
				console.log(product);
				if (product) {
					res.status(303)
						.send({
							message: 'This product already exists',
							uri: `/products/${product._id}`
						});
				} else {
					prod.save()
						.then(() => {
							res.status(201)
								.send({
									message:'Success',
									id: prod._id,
									uri: `/products/${prod._id}`
								})
							//Shouldn't we redirect to /products page after this?
							// Link is now being provided. I guess index.js could handle that part
						})
						.catch(err => {
							console.error(err);
							res.status(500).send({
								message: 'A server side error has occured'
							})
						})
				}
			})
	}
})

app.delete('/products/:id', (req, res) => {
	// Delete it. 
	// returns ok, n and deletedCount. All should be 1 for successful delete
	Promise.all([
		models.Product.deleteOne({
			_id: req.params.id
		}),
		models.StackProductMap.deleteMany({
			product: req.params.id
		})
	])
		.then(results => {
			res.send(results)
		})
		.catch(err => {
			console.error(err);
			res.status(500).send({
				message: 'A server side error has occured'
			})
		})
})

app.locals.db.once('open', () => {
	let PORT = process.env.PORT || 5000
	app.listen(PORT, () => {
		console.log(`Server is running on Port: ${PORT}`);
	})
})