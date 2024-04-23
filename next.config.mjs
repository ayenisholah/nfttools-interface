/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["mdx", "md", "jsx", "js", "tsx", "ts"],
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.resolve.fallback.fs = false;
		}
		config.experiments = {
			asyncWebAssembly: true,
			layers: true,
		};
		return config;
	},
};

export default nextConfig;
