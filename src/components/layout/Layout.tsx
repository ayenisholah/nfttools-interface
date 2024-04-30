import React, { useEffect, useMemo } from "react";
import Sidebar from "./sidebar/Sidebar";
import { useSettingsState } from "@/store/settings.store";
import { useCollectionsState } from "@/store/collections.store";
import { useBidStateStore } from "@/store/bid.store";
import { useCombinedState } from "@/store/combine.store";

const Layout: React.FC<LayoutProps> = ({ children }) => {
	const {
		rateLimit,
		apiKey,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
		defaultCounterLoopTime,
	} = useSettingsState();

	const { bidStates } = useBidStateStore();

	const { collections } = useCollectionsState();

	const combinedCollections = useMemo(() => {
		return collections.map((collection) => {
			const bidState = bidStates.find(
				(bid) => bid.collectionSymbol === collection.collectionSymbol
			);
			return {
				collectionSymbol: collection.collectionSymbol,
				minBid: collection.minBid,
				maxBid: collection.maxBid,
				minFloorBid: collection.minFloorBid,
				maxFloorBid: collection.maxFloorBid,
				outBidMargin: collection.outBidMargin,
				bidCount: collection.bidCount,
				fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
				tokenReceiveAddress:
					collection.tokenReceiveAddress || tokenReceiveAddress,
				duration: collection.duration || bidExpiration,
				scheduledLoop: collection.scheduledLoop || defaultLoopTime,
				counterbidLoop: collection.counterbidLoop || defaultCounterLoopTime,
				running: bidState?.running || false,
			};
		});
	}, [
		collections,
		bidStates,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
		defaultCounterLoopTime,
	]);

	useEffect(() => {
		class Mutex {
			private locked: boolean;
			private waitQueue: (() => void)[];

			constructor() {
				this.locked = false;
				this.waitQueue = [];
			}

			async acquire() {
				if (this.locked) {
					await new Promise<void>((resolve) => this.waitQueue.push(resolve));
				}
				this.locked = true;
			}

			release() {
				if (this.waitQueue.length > 0) {
					const resolve = this.waitQueue.shift();
					resolve?.();
				} else {
					this.locked = false;
				}
			}
		}

		async function startProcessing() {
			await Promise.all(
				combinedCollections.map(async (item) => {
					console.log({ item });

					if (!item || !item.running) {
						console.log("STOP!!!");
					}
					let isScheduledLoopRunning = false;
					let isCounterBidLoopRunning = false;
					let mutex = new Mutex();
					await Promise.all([
						(async () => {
							while (true) {
								await mutex.acquire();
								if (!isCounterBidLoopRunning) {
									isScheduledLoopRunning = true;

									fetch("/api/bid", {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											requestType: "processScheduledLoop",
											data: { ...item, apiKey, rateLimit },
										}),
									});
									isScheduledLoopRunning = false;
								}
								mutex.release();
								await delay(item.scheduledLoop * 1000);
							}
						})(),
						(async () => {
							while (true) {
								await mutex.acquire();
								if (!isScheduledLoopRunning) {
									isCounterBidLoopRunning = true;
									fetch("/api/bid", {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											requestType: "processCounterBidLoop",
											data: { ...item, apiKey, rateLimit },
										}),
									});

									isCounterBidLoopRunning = false;
								}
								mutex.release();
								await delay(item.counterbidLoop * 1000);
							}
						})(),
					]);
				})
			);
		}

		startProcessing();
	}, [apiKey, bidStates, combinedCollections, rateLimit]);

	function delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	return (
		<div>
			<Sidebar />
			<div className='ml-[300px]'>{children}</div>
		</div>
	);
};

export default Layout;

interface LayoutProps {
	children?: React.ReactNode;
}
