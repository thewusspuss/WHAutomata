const express = require('express');
let models = require('./models');
const axios = require('axios');
let app = express();
app.use(express.urlencoded({
	extended: true
}));
app.use(express.json());
app.use(express.static('./public'));
app.set('views', './views');
app.set('view engine', 'pug');

app.locals.db = models.mongoose.connection;
app.locals.db.on('error', console.error.bind(console, 'MongoDB connection error:'));

delete process.env['http_proxy'];
delete process.env['HTTP_PROXY'];
delete process.env['https_proxy'];
delete process.env['HTTPS_PROXY'];

app.get('/', (req, res) => {
	res.render('home');
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
				res.render('stacks',{stacks});
			})
			.catch(err => {
				console.error(err);
				res.status(500).send({
					message: 'A server side error has occured'
				})
			})
})

app.get('/stacks/:id', (req, res) => {
	var id = req.params.id;
	models.Stack.findOne({
			_id: id
		})
		.then(stack => {
			res.render('stackDetails',{stack});
		})
		.catch(err => {
			console.error(err);
			res.status(500).send({
				message: 'A server side error has occured'
			})
		})
})

app.get('/addProductToStack',(req,res)=>{
	models.Stack.find()
		.then(stacks => {
			
			models.Product.find()
				.then(products => {
					res.render('addProductToStack', {products,stacks});
				})
				.catch(err => {
					console.error(err);
					res.send("Whoops")
				})
			})
			.catch(err => {
				console.error(err);
				res.status(500).send({
					message: 'A server side error has occured'
				})
			})
})
app.post('/addProductToStack', (req, res) => { 
	var product_id = req.body.product_id
	var stack = {
		_id: req.body.stack_id
	}

	req.body.count = req.body.count || 1
	// console.log(typeof req.body.count);
	req.body.count = parseInt(req.body.count) || 1
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
							map: map
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


app.get('/products', (req, res) => {
	// page that shows all the products available in a list format and on clicking on each item the user can view product details
	models.Product.find()
	.then(products => {
		res.render('products', {products});
	})
	.catch(err => {
		console.error(err);
		res.send("Whoops")
	})
})
app.post('/products', (req, res) => {
	res.send();
})

app.get('/addProduct',(req, res) => {
//Add products page
	res.render('addProduct');
})
app.post('/addProduct', (req, res) => {
	// we are taking productName,productId,batch and expiry date in yyyy-mm-dd
	// send message added successfully and redirect to the products page
	// increase the product count and map to stack id in stackProductSchema
	// we should probably do joi validation here
	// name and batch are required. Expiry is not. id is autogenerated
	
	var prod = {
		name: req.body.productName,
		batch: new Date(req.body.batch)
	}
	if (req.body.expiry) {
		prod.expiry = req.body.expiry
	}
	prod = new models.Product(prod)
	var validation_errors = prod.validateSync()
	if (validation_errors) { 
		// Check out 
		// https://mongoosejs.com/docs/validation.html
		// i'm redirecting to the form page with the message
		//res.send('Improper form data')
		res.statusCode(400).render('addProduct',{message:'Improper form data'});
	} 
	else {
		console.log(prod)
		models.Product.findOne({
			name: prod.name,
			batch: prod.batch
		})
		.then(product => {
			console.log(product);
			if (product) {
				res.render('addProduct',{message:'This product already exists'});
			} 
			else {
				prod.save()
				.then(() => {
					models.Product.find()
					.then(products => {
						res.render('products', {products,message:"Successfully Added"});
					})
					.catch(err => {
						console.error(err);
						res.send("Whoops")
					})
					//res.send('Success')
					//Shouldn't we redirect to /products page after this?
				})
				.catch(err => {
					console.error(err);
					res.send('Whoops. Something happened')
				})
			}
		})
	}
	// res.send();
})

app.get('/deleteProduct', (req,res) => {
	models.Product.find()
	.then(products => {
		res.render('deleteProduct', {products});
	})
	.catch(err => {
		console.error(err);
		res.send("Whoops")
	})
})
app.post('/deleteProduct', (req, res) => {
		//we are taking productId and a confirmation that if you really wanna delete the product
		//send message deleted successfully and redirect to the products page
		console.log(req.body)
		if (req.body.delete.toLowerCase() == 'no') {
			res.send('Did not delete')
			return
		}
		Promise.all([
				models.Product.deleteOne({
					_id: req.body.id
					
				}),
				models.StackProductMap.deleteMany({
					product: req.body.id
				})
			])
			.then(results => {
				models.Product.find()
				.then(products => {
					res.render('products', {products,message:"Successfully Deleted"});
				})
				.catch(err => {
					console.error(err);
					res.send("Whoops")
				})
				//res.send(results)
			})
			.catch(err => {
				console.error(err);
				res.status(500).send({
					message: 'A server side error has occured'
				})
			})
})

app.get('/products/:id',(req,res)=>{
    var id=req.params.id;
	//extract product details based on the id
	//get stack details and count of products by comparing product id in stackProductMapSchema
	Promise.all(
		[
			models.Product.findOne({
				_id: id
			}),
			models.StackProductMap.find({
					product: id
				})
				.populate('stack')
		]
	)
	.then(([product, stackmapdetails]) => {
		console.log(stackmapdetails)
		res.render('productDetails', {product,stackmapdetails})
		//res.send({product, stackmapdetails})
	})
	.catch(err => {
		console.error(err);
		res.send('Whoops. Something happened')
	})
})

app.get('/bots', (req, res) => {
	// query bots for location here.
	// pass locations to render
	axios.get('http://192.168.43.165:8000/')
		.then(response => {
			// res.send(response.body)
			res.render('botDetails', {
				bot: response.data
			});
		})
		.catch(err => {
			console.log(err.message)
			res.render('botDetails', {message:"Bot is offline"})
		})
		//send {bots} too
})
app.get('/bot/:id',(req,res)=>{
	var id=req.params.id;
	//extract bot location and it's status active or not 
	res.render('botDetails',{botDetails});
})
app.get('/sensors', (req, res) => {
	res.render('sensors');
})

// app.get('*',(req,res)=>{
// 	res.send("This is not a valid URL");
// 	});
// app.post('*',(req,res)=>{
// 	res.send("This is not a valid URL");
// 	});

app.post('/cb', (req, res) => {
	console.log(req.body);
	if (['g','r'].includes(req.body.cmd)) {
		models.Stack.findOne({
			x: req.body.location.x,
			y: req.body.location.y,
		})
		.then(stack => {
			stack.processing = false;
			stack.atControl = (req.body.cmd == 'g' && req.body.message == 'done');
			return stack.save();
		})		
		.then(stack => {
			res.send('server: Recieved')
		})
		.catch(err => {
			console.log(err);
			res.send('server: whoops')
		})
	} else {
		res.send('server: ok')
	}
})

app.post('/tasks', (req, res) => {
	if (!req.body.id && req.body.cmd == 's' || req.body.cmd == 'a') {
		axios.post('http://192.168.43.165:8000/tasks', {
			cmd: req.body.cmd,
			callback_url: 'http://192.168.43.210:3000/cb'
		})
		.then((response) => {
				console.log(response.status);
				console.log(response.data);
				// console.log(response.body);
				res.redirect(`/bots`)
			})
			.catch(err => {
				// console.log(err);
				if (err.response.status == 503) {
					res.send('Bot was busy')
				} else if (err == 'no stack') {
					res.send(err)
				} else {
					res.send('whoops')
				}
			})
	} else {	
		models.Stack.findOne({
			_id: req.body.id,
		})
		.then(stack => {
			if (stack) {
				stack.processing = true;
				return stack.save()
			} else {
				throw "no stack"
			}
		})
		.then(stack => {
			return axios.post('http://192.168.43.165:8000/tasks', {
				x: stack.x,
				y: stack.y,
				cmd: req.body.cmd || 'g',
				callback_url: 'http://192.168.43.210:3000/cb'
			})
		})
		.then((response) => {
			console.log(response.status);
			console.log(response.data);
			// console.log(response.body);
			res.redirect(`/stacks/${req.body.id}`)
		})
		.catch(err => {
			// console.log(err);
			if (err == 'no stack') {
				res.send(err)
			} else if (err.response.status == 503) {
				res.send('Bot was busy')
			} else {
				res.send('whoops')
			}
		})
	}
})

app.locals.db.once('open', () => {
	let PORT = process.env.PORT || 3000
	app.listen(PORT, () => {
		console.log(`Server is running on Port: ${PORT}`);
	})
})
